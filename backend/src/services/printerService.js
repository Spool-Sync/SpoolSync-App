import { PrismaClient } from '@prisma/client';
import { getIO } from '../websocket/index.js';
import * as integrationService from './integrationService.js';
import { updateWeight } from './spoolService.js';
import logger from '../middleware/logger.js';
import {
  isBuddyPrinter,
  fetchPrinterInfo,
  setSpoolSyncEnabled,
  pushFilamentToFirmware,
} from './spoolSyncFirmwareService.js';

const prisma = new PrismaClient();

// States that indicate a print job finished (not paused, not error)
const PRINT_COMPLETED_STATES = new Set(['OPERATIONAL', 'UNKNOWN', 'OFFLINE']);

const printerInclude = {
  spoolHolders: {
    include: {
      esp32Device: { select: { deviceId: true, name: true } },
      associatedSpool: { include: { filamentType: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
};

export async function create(data) {
  const printer = await prisma.printer.create({ data, include: printerInclude });
  getIO()?.emit('printer:created', printer);

  // Auto-configure prusalink_buddy printers: detect extruder count and enable SpoolSync mode.
  if (isBuddyPrinter(printer)) {
    const cd = printer.connectionDetails;

    // 1. Detect extruder count and auto-create holder slots.
    const info = await fetchPrinterInfo(cd);
    const extruderCount = info?.extruder_count ?? 1;
    if (extruderCount > 0) {
      await setSpoolHolderCount(printer.printerId, extruderCount);
    }

    // 2. Enable SpoolSync mode on the firmware (non-fatal if unreachable).
    await setSpoolSyncEnabled(cd, true);
  }

  return getById(printer.printerId);
}

export async function list() {
  return prisma.printer.findMany({ include: printerInclude, orderBy: { name: 'asc' } });
}

export async function getById(printerId) {
  return prisma.printer.findUniqueOrThrow({ where: { printerId }, include: printerInclude });
}

export async function update(printerId, data) {
  const printer = await prisma.printer.update({ where: { printerId }, data, include: printerInclude });
  getIO()?.emit('printer:updated', printer);
  return printer;
}

export async function remove(printerId) {
  await prisma.printer.delete({ where: { printerId } });
  getIO()?.emit('printer:deleted', { printerId });
}

export async function syncStatus(printerId) {
  const printer = await getById(printerId);
  const prevStatus = printer.status;

  const integration = await integrationService.getIntegration(printer.type);
  if (!integration) return printer;

  try {
    const newStatus = await integration.getStatus(printer.connectionDetails);
    const jobDetails = await integration.getPrintProgress(printer.connectionDetails);

    let printingStartedAt = printer.printingStartedAt;

    // ── Transition: → PRINTING ────────────────────────────────────────────────
    if (newStatus === 'PRINTING' && prevStatus !== 'PRINTING') {
      printingStartedAt = new Date();
      // Snapshot start weights for all associated spools
      for (const holder of printer.spoolHolders) {
        if (holder.associatedSpoolId && holder.currentWeight_g != null) {
          await prisma.spool.update({
            where: { spoolId: holder.associatedSpoolId },
            data: { printStartWeight_g: holder.currentWeight_g },
          });
        }
      }
    }

    // ── Transition: PRINTING → completed ─────────────────────────────────────
    if (prevStatus === 'PRINTING' && PRINT_COMPLETED_STATES.has(newStatus)) {
      const jobStartedAt = printer.printingStartedAt ?? new Date();

      for (const holder of printer.spoolHolders) {
        if (!holder.associatedSpoolId) continue;

        const spool = await prisma.spool.findUnique({
          where: { spoolId: holder.associatedSpoolId },
          select: { spoolId: true, printStartWeight_g: true },
        });
        if (!spool) continue;

        const endWeight = holder.currentWeight_g;
        const startWeight = spool.printStartWeight_g;
        const filamentUsed = (startWeight != null && endWeight != null)
          ? Math.max(0, startWeight - endWeight)
          : null;

        // Record the print job
        await prisma.printJob.create({
          data: {
            printerId,
            spoolId: spool.spoolId,
            filamentUsed_g: filamentUsed,
            fileName: typeof jobDetails === 'object' ? (jobDetails?.fileName ?? null) : null,
            startedAt: jobStartedAt,
            completedAt: new Date(),
          },
        });

        // Now apply the accumulated weight change
        if (endWeight != null) {
          await updateWeight(spool.spoolId, endWeight, 'print_complete');
        }

        // Clear the snapshot
        await prisma.spool.update({
          where: { spoolId: spool.spoolId },
          data: { printStartWeight_g: null },
        });
      }

      printingStartedAt = null;
    }

    const updated = await prisma.printer.update({
      where: { printerId },
      data: { status: newStatus, currentJobDetails: jobDetails, printingStartedAt },
      include: printerInclude,
    });

    getIO()?.emit('printer:status_update', { printerId, status: newStatus });
    if (jobDetails) getIO()?.emit('printer:job_update', { printerId, jobDetails });

    return updated;
  } catch (err) {
    logger.error(`[printerService] syncStatus failed for printer ${printerId} (${printer.name}): ${err.message}`);

    const errored = await prisma.printer.update({
      where: { printerId },
      data: { status: 'ERROR' },
      include: printerInclude,
    });
    getIO()?.emit('printer:status_update', { printerId, status: 'ERROR' });
    return errored;
  }
}

// Set the number of spool holder slots for a printer.
// Creates holders up to `count`; removes extras (preferring empty ones).
export async function setSpoolHolderCount(printerId, count) {
  const existing = await prisma.spoolHolder.findMany({
    where: { attachedPrinterId: printerId, assignmentType: 'PRINTER' },
    orderBy: { createdAt: 'asc' },
  });

  const diff = count - existing.length;

  if (diff > 0) {
    // Create new slots
    for (let i = existing.length + 1; i <= count; i++) {
      await prisma.spoolHolder.create({
        data: {
          name: `Slot ${i}`,
          type: 'PASSIVE',
          assignmentType: 'PRINTER',
          attachedPrinterId: printerId,
        },
      });
    }
  } else if (diff < 0) {
    // Remove extras, preferring unoccupied ones
    const toRemove = [...existing]
      .sort((a, b) => {
        // unoccupied first
        if (!a.associatedSpoolId && b.associatedSpoolId) return -1;
        if (a.associatedSpoolId && !b.associatedSpoolId) return 1;
        return 0;
      })
      .slice(0, Math.abs(diff));
    for (const h of toRemove) {
      await prisma.spoolHolder.delete({ where: { spoolHolderId: h.spoolHolderId } });
    }
  }

  const printer = await getById(printerId);
  getIO()?.emit('printer:updated', printer);
  return printer;
}

// Link an ESP32 channel to a specific spool holder on this printer
export async function configureHolder(spoolHolderId, { esp32DeviceId, channel, hasLoadCell, hasNfc, nfcReaderChannel, type }) {
  const holder = await prisma.spoolHolder.update({
    where: { spoolHolderId },
    data: {
      ...(esp32DeviceId !== undefined && { esp32DeviceId: esp32DeviceId || null }),
      ...(channel !== undefined && { channel: channel ?? null }),
      ...(hasLoadCell !== undefined && { hasLoadCell }),
      ...(hasNfc !== undefined && { hasNfc }),
      ...(nfcReaderChannel !== undefined && { nfcReaderChannel: nfcReaderChannel ?? null }),
      ...(type !== undefined && { type }),
    },
    include: {
      esp32Device: { select: { deviceId: true, name: true } },
      associatedSpool: { include: { filamentType: true } },
    },
  });
  getIO()?.emit('holder:updated', holder);
  return holder;
}

// Assign a spool to a printer slot (also sets spool.currentPrinterId)
export async function assignSpoolToHolder(spoolHolderId, spoolId) {
  const holder = await prisma.spoolHolder.findUniqueOrThrow({
    where: { spoolHolderId },
    select: { attachedPrinterId: true, assignmentType: true },
  });

  // Block assignment while printer is printing
  if (holder.attachedPrinterId) {
    const printerStatus = await prisma.printer.findUnique({
      where: { printerId: holder.attachedPrinterId },
      select: { status: true, name: true },
    });
    if (printerStatus?.status === 'PRINTING') {
      const err = new Error(`Cannot change filament while ${printerStatus.name} is printing`);
      err.statusCode = 409;
      throw err;
    }
  }

  // Clear previous occupant if any
  const prev = await prisma.spoolHolder.findFirst({
    where: { associatedSpoolId: spoolId },
    select: { spoolHolderId: true },
  });
  if (prev) {
    await prisma.spoolHolder.update({
      where: { spoolHolderId: prev.spoolHolderId },
      data: { associatedSpoolId: null },
    });
  }

  await prisma.spoolHolder.update({
    where: { spoolHolderId },
    data: { associatedSpoolId: spoolId },
  });

  const updated = await getById(holder.attachedPrinterId);
  getIO()?.emit('printer:updated', updated);

  // Push filament type to prusalink_buddy firmware (non-fatal).
  if (isBuddyPrinter(updated)) {
    const spool = updated.spoolHolders.find(h => h.spoolHolderId === spoolHolderId);
    const toolIndex = updated.spoolHolders
      .filter(h => h.assignmentType === 'PRINTER')
      .findIndex(h => h.spoolHolderId === spoolHolderId);
    if (toolIndex >= 0 && spool?.associatedSpool?.filamentType) {
      await pushFilamentToFirmware(updated.connectionDetails, toolIndex, spool.associatedSpool.filamentType);
    }
  }

  return updated;
}

// Remove a spool from a holder slot
export async function removeSpoolFromHolder(spoolHolderId) {
  const holder = await prisma.spoolHolder.findUniqueOrThrow({
    where: { spoolHolderId },
    select: { associatedSpoolId: true, attachedPrinterId: true },
  });

  // Block removal while printer is printing
  if (holder.attachedPrinterId) {
    const printerStatus = await prisma.printer.findUnique({
      where: { printerId: holder.attachedPrinterId },
      select: { status: true, name: true },
    });
    if (printerStatus?.status === 'PRINTING') {
      const err = new Error(`Cannot change filament while ${printerStatus.name} is printing`);
      err.statusCode = 409;
      throw err;
    }
  }

  if (holder.associatedSpoolId) {
    await prisma.spool.update({
      where: { spoolId: holder.associatedSpoolId },
      data: { printStartWeight_g: null },
    });
  }

  await prisma.spoolHolder.update({
    where: { spoolHolderId },
    data: { associatedSpoolId: null },
  });

  const printer = await getById(holder.attachedPrinterId);
  getIO()?.emit('printer:updated', printer);

  // Clear filament on prusalink_buddy firmware (non-fatal).
  if (isBuddyPrinter(printer)) {
    const toolIndex = printer.spoolHolders
      .filter(h => h.assignmentType === 'PRINTER')
      .findIndex(h => h.spoolHolderId === spoolHolderId);
    if (toolIndex >= 0) {
      await pushFilamentToFirmware(printer.connectionDetails, toolIndex, null);
    }
  }

  return printer;
}

/**
 * Batch-reload filaments into printer slots.
 * assignments: [{ spoolHolderId, spoolId | null }]
 *   spoolId null  → clear that slot
 *   spoolId value → assign that spool to the slot
 *
 * When firmware support is added, this will also send the physical
 * load/unload command to the printer after updating the database.
 * See FILAMENT_RELOAD_FIRMWARE_API.md for the planned API contract.
 */
export async function reloadFilaments(printerId, assignments) {
  for (const { spoolHolderId, spoolId } of assignments) {
    if (spoolId) {
      await assignSpoolToHolder(spoolHolderId, spoolId);
    } else {
      await removeSpoolFromHolder(spoolHolderId);
    }
  }

  // TODO: send hardware reload command to printer via integration
  // (see FILAMENT_RELOAD_FIRMWARE_API.md)
  logger.info(`reloadFilaments: staged ${assignments.length} slot(s) for printer ${printerId} — hardware command not yet implemented`);

  const printer = await getById(printerId);
  getIO()?.emit('printer:updated', printer);
  return printer;
}

export async function associateSpoolHolder(printerId, spoolHolderId) {
  await prisma.spoolHolder.update({
    where: { spoolHolderId },
    data: { attachedPrinterId: printerId },
  });
  const printer = await getById(printerId);
  getIO()?.emit('printer:updated', printer);
  return printer;
}

export async function dissociateSpoolHolder(printerId, spoolHolderId) {
  await prisma.spoolHolder.update({
    where: { spoolHolderId, attachedPrinterId: printerId },
    data: { attachedPrinterId: null },
  });
  const printer = await getById(printerId);
  getIO()?.emit('printer:updated', printer);
  return printer;
}

export async function getPrintJobs(printerId) {
  return prisma.printJob.findMany({
    where: { printerId },
    include: { spool: { include: { filamentType: true } } },
    orderBy: { completedAt: 'desc' },
    take: 50,
  });
}
