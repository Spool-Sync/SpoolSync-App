import { PrismaClient } from '@prisma/client';
import { getIO } from '../websocket/index.js';
import * as integrationService from './integrationService.js';
import { updateWeight } from './spoolService.js';
import logger from '../middleware/logger.js';
import {
  isBuddyPrinter,
  detectCustomFirmware,
  fetchPrinterInfo,
  setSpoolSyncEnabled,
  pushFilamentToFirmware,
  triggerFilamentLoad,
  triggerFilamentUnload,
  triggerFilamentChange,
  configureSyslog,
} from './spoolSyncFirmwareService.js';

// PrusaLink integration types that might be running custom firmware.
const UPGRADEABLE_TYPES = new Set(['prusalink']);
// How long to wait between re-probes of a standard prusalink printer (ms).
const FIRMWARE_RECHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
// In-memory cache: printerId → timestamp of last firmware probe.
const firmwareCheckCache = new Map();
// In-memory cache: printerId → timestamp of last extruder-count sync (buddy printers).
const extruderSyncCache = new Map();

const prisma = new PrismaClient();

// States that indicate a print job finished (not paused, not error)
const PRINT_COMPLETED_STATES = new Set(['OPERATIONAL', 'UNKNOWN', 'OFFLINE']);

const printerInclude = {
  spoolHolders: {
    include: {
      esp32Device: { select: { deviceId: true, name: true } },
      associatedSpool: { include: { filamentType: true } },
      stagedSpool: { include: { filamentType: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
};

export async function create(data) {
  // Auto-detect custom firmware: if the user picked a standard prusalink type
  // but the printer is actually running our custom firmware, transparently
  // upgrade the type before saving so the full buddy auto-config runs.
  let resolvedType = data.type;
  if (UPGRADEABLE_TYPES.has(data.type)) {
    const isCustom = await detectCustomFirmware(data.connectionDetails);
    if (isCustom) {
      logger.info(`[printerService] custom firmware detected at ${data.connectionDetails?.base_url} — upgrading type to prusalink_buddy`);
      resolvedType = 'prusalink_buddy';
    }
  }

  const printer = await prisma.printer.create({
    data: { ...data, type: resolvedType },
    include: printerInclude,
  });
  getIO()?.emit('printer:created', printer);

  // Auto-configure prusalink_buddy printers: detect extruder count and enable SpoolSync mode.
  if (isBuddyPrinter(printer)) {
    await _runBuddyAutoConfig(printer);
  }

  // Mark this printer as freshly checked so polling doesn't immediately re-probe.
  firmwareCheckCache.set(printer.printerId, Date.now());

  return getById(printer.printerId);
}

/**
 * Run the full prusalink_buddy auto-configuration for a newly detected printer:
 *  1. Fetch extruder count and create the right number of spool holder slots.
 *  2. Enable SpoolSync mode on the firmware.
 */
async function _runBuddyAutoConfig(printer) {
  const cd = printer.connectionDetails;
  const info = await fetchPrinterInfo(cd);
  const extruderCount = info?.extruder_count ?? 1;
  if (extruderCount > 0) {
    await setSpoolHolderCount(printer.printerId, extruderCount);
  }
  await setSpoolSyncEnabled(cd, true);

  // Push syslog destination if configured via env var
  const syslogHost = process.env.SYSLOG_HOST;
  if (syslogHost) {
    await configureSyslog(cd, syslogHost);
  }
}

/**
 * Check if a standard prusalink printer is now running custom firmware and,
 * if so, upgrade it in the database and run buddy auto-config.
 * Uses an in-memory TTL cache to avoid probing on every poll.
 * Returns the (possibly upgraded) printer record.
 */
async function _maybeUpgradeToBuddy(printer) {
  if (!UPGRADEABLE_TYPES.has(printer.type)) return printer;

  const lastCheck = firmwareCheckCache.get(printer.printerId) ?? 0;
  if (Date.now() - lastCheck < FIRMWARE_RECHECK_INTERVAL_MS) return printer;

  firmwareCheckCache.set(printer.printerId, Date.now());

  const isCustom = await detectCustomFirmware(printer.connectionDetails);
  if (!isCustom) return printer;

  logger.info(`[printerService] custom firmware detected on existing printer ${printer.printerId} (${printer.name}) — upgrading to prusalink_buddy`);

  const upgraded = await prisma.printer.update({
    where: { printerId: printer.printerId },
    data: { type: 'prusalink_buddy' },
    include: printerInclude,
  });
  getIO()?.emit('printer:updated', upgraded);

  await _runBuddyAutoConfig(upgraded);
  return getById(printer.printerId);
}

// Inject features array from the integration config into a printer record.
async function _withFeatures(printer) {
  const features = await integrationService.getFeatures(printer.type);
  return { ...printer, features };
}

async function _withFeaturesMany(printers) {
  return Promise.all(printers.map(_withFeatures));
}

export async function list() {
  const printers = await prisma.printer.findMany({ include: printerInclude, orderBy: { name: 'asc' } });
  return _withFeaturesMany(printers);
}

export async function getById(printerId) {
  const printer = await prisma.printer.findUniqueOrThrow({ where: { printerId }, include: printerInclude });
  return _withFeatures(printer);
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
  let printer = await getById(printerId);

  // Opportunistically upgrade standard prusalink printers to prusalink_buddy
  // if we detect the custom firmware (throttled to once per 10 minutes).
  printer = await _maybeUpgradeToBuddy(printer);

  // For buddy printers: fetch firmware info on every poll to get active_tool in real-time.
  // Reuse the same response to throttle the extruder_count change check (every 10 minutes).
  let activeTool = undefined;
  if (isBuddyPrinter(printer)) {
    const info = await fetchPrinterInfo(printer.connectionDetails);
    if (info?.active_tool != null) {
      activeTool = info.active_tool;
    }
    if (printer.features?.includes('filament_reload')) {
      const lastSync = extruderSyncCache.get(printerId) ?? 0;
      if (Date.now() - lastSync >= FIRMWARE_RECHECK_INTERVAL_MS) {
        extruderSyncCache.set(printerId, Date.now());
        const extruderCount = info?.extruder_count;
        if (extruderCount && extruderCount !== printer.spoolHolders.length) {
          logger.info(`[printerService] extruder count changed for ${printer.name}: ${printer.spoolHolders.length} → ${extruderCount}`);
          await setSpoolHolderCount(printerId, extruderCount);
          printer = await getById(printerId);
        }
      }
    }
  }

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
      data: {
        status: newStatus,
        currentJobDetails: jobDetails,
        printingStartedAt,
        ...(activeTool !== undefined ? { activeTool } : {}),
      },
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
export async function assignSpoolToHolder(spoolHolderId, spoolId, force = false) {
  const holder = await prisma.spoolHolder.findUniqueOrThrow({
    where: { spoolHolderId },
    select: { attachedPrinterId: true, assignmentType: true, associatedSpoolId: true },
  });

  // Block assignment while printer is printing (unless force=true)
  if (!force && holder.attachedPrinterId) {
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

  // If a different spool is already in this slot, clear its printStartWeight snapshot
  if (holder.associatedSpoolId && holder.associatedSpoolId !== spoolId) {
    await prisma.spool.update({
      where: { spoolId: holder.associatedSpoolId },
      data: { printStartWeight_g: null },
    });
  }

  // Clear this slot from wherever the new spool currently lives
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

  // Push filament type to firmware if the integration supports it (non-fatal).
  if (updated.features?.includes('filament_push')) {
    const spool = updated.spoolHolders.find(h => h.spoolHolderId === spoolHolderId);
    const toolIndex = updated.spoolHolders
      .filter(h => h.assignmentType === 'PRINTER')
      .findIndex(h => h.spoolHolderId === spoolHolderId);
    if (toolIndex >= 0) {
      // If SpoolSync had no spool assigned to this slot, the printer's physical
      // filament sensor might still detect filament that was loaded outside of
      // SpoolSync. Pre-unload so the slot is clear before the new filament type
      // is pushed and a physical load is triggered by the user.
      // M702 checks the sensor internally and exits cleanly if nothing is loaded.
      if (!holder.associatedSpoolId) {
        await triggerFilamentUnload(updated.connectionDetails, toolIndex, null);
      }
      if (spool?.associatedSpool?.filamentType) {
        await pushFilamentToFirmware(updated.connectionDetails, toolIndex, spool.associatedSpool.filamentType);
      }
    }
  }

  return updated;
}

// Remove a spool from a holder slot
export async function removeSpoolFromHolder(spoolHolderId, force = false) {
  const holder = await prisma.spoolHolder.findUniqueOrThrow({
    where: { spoolHolderId },
    select: {
      associatedSpoolId: true,
      attachedPrinterId: true,
      associatedSpool: { select: { filamentType: true } },
    },
  });

  // Block removal while printer is printing (unless force=true)
  if (!force && holder.attachedPrinterId) {
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

  // Trigger physical unload + clear filament metadata on firmware (non-fatal).
  if (printer.features?.includes('filament_push')) {
    const toolIndex = printer.spoolHolders
      .filter(h => h.assignmentType === 'PRINTER')
      .findIndex(h => h.spoolHolderId === spoolHolderId);
    if (toolIndex >= 0) {
      // Unload the physical filament. Pass the removed spool's filament type so the
      // firmware can pre-heat to the correct nozzle temperature before retracting.
      // triggerFilamentUnload is safe even if the slot is physically empty — the
      // firmware's M702 checks its own filament sensor and exits cleanly if nothing
      // is detected.
      await triggerFilamentUnload(printer.connectionDetails, toolIndex, holder.associatedSpool?.filamentType ?? null);
      // Clear the filament-type metadata slot on the printer.
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

// Stage a spool as pending onto an occupied holder (buddy printers only).
// Does NOT commit to associatedSpoolId; that happens during begin-reload.
export async function stageSpoolToHolder(spoolHolderId, spoolId) {
  const holder = await prisma.spoolHolder.findUniqueOrThrow({
    where: { spoolHolderId },
    select: { attachedPrinterId: true },
  });

  const printerForCheck = await getById(holder.attachedPrinterId);
  if (!printerForCheck.features?.includes('filament_reload')) {
    const err = new Error('This printer does not support the filament_reload feature');
    err.statusCode = 400;
    throw err;
  }

  await prisma.spool.findUniqueOrThrow({ where: { spoolId } });

  await prisma.spoolHolder.update({
    where: { spoolHolderId },
    data: { stagedSpoolId: spoolId },
  });

  const printer = await getById(holder.attachedPrinterId);
  getIO()?.emit('printer:updated', printer);
  return printer;
}

// Clear a staged spool without committing it.
export async function clearStagedSpool(spoolHolderId) {
  const holder = await prisma.spoolHolder.findUniqueOrThrow({
    where: { spoolHolderId },
    select: { attachedPrinterId: true },
  });

  await prisma.spoolHolder.update({
    where: { spoolHolderId },
    data: { stagedSpoolId: null },
  });

  const printer = await getById(holder.attachedPrinterId);
  getIO()?.emit('printer:updated', printer);
  return printer;
}

// Begin a sequential filament reload for all staged slots on a buddy printer.
// Returns the printer immediately (reload runs in the background).
export async function beginReload(printerId) {
  const printer = await getById(printerId);
  if (!printer.features?.includes('filament_reload')) {
    const err = new Error('This printer does not support the filament_reload feature');
    err.statusCode = 400;
    throw err;
  }

  // toolIndex must match the position among PRINTER-type holders (same logic as
  // assignSpoolToHolder) so the firmware receives the correct slot number.
  // spoolHolders is already ordered createdAt asc via printerInclude.
  const stagedHolders = printer.spoolHolders
    .filter(h => h.assignmentType === 'PRINTER')
    .map((h, idx) => ({ holder: h, toolIndex: idx }))
    .filter(({ holder }) => holder.stagedSpoolId);

  if (stagedHolders.length === 0) return printer;

  const reloadJobState = {
    status: 'reloading',
    total: stagedHolders.length,
    done: 0,
    currentTool: null,
    currentMaterial: null,
    currentColor: null,
    currentSpoolName: null,
  };

  const initial = await prisma.printer.update({
    where: { printerId },
    data: { reloadJobState },
    include: printerInclude,
  });
  getIO()?.emit('printer:updated', initial);

  // Non-blocking: run queue in background (errors handled inside _runReloadQueue)
  _runReloadQueue(printerId, stagedHolders).catch(() => {});

  return initial;
}

async function _runReloadQueue(printerId, queue) {
  try {
    for (const { holder, toolIndex } of queue) {
      const ft = holder.stagedSpool?.filamentType;
      const doneIndex = queue.findIndex(q => q.holder.spoolHolderId === holder.spoolHolderId);

      // Capture replace flag BEFORE commit so it's available for progressState and firmware call.
      const replace = !!holder.associatedSpoolId;

      // Update progress state with full filament details for the banner UI.
      const progressState = {
        status: 'reloading',
        total: queue.length,
        done: doneIndex,
        currentTool: toolIndex,
        isReplace: replace,
        currentBrand: ft?.brand ?? null,
        currentMaterial: ft?.material ?? null,
        currentSpoolName: ft?.name ?? null,
        currentColor: ft?.colorHex ?? null,
        currentNozzleTempMin: ft?.nozzleTempMin ?? null,
        currentNozzleTempMax: ft?.nozzleTempMax ?? null,
      };
      const progPrinter = await prisma.printer.update({
        where: { printerId },
        data: { reloadJobState: progressState },
        include: printerInclude,
      });
      getIO()?.emit('printer:updated', progPrinter);

      // Commit: promote stagedSpoolId → associatedSpoolId.
      // Use assignSpoolToHolder (force=true) so it correctly clears any previous
      // holder association for this spool (handles the @unique constraint on associatedSpoolId).
      // assignSpoolToHolder also pushes the filament type to firmware.
      await assignSpoolToHolder(holder.spoolHolderId, holder.stagedSpoolId, true);

      // Clear the staged pointer now that we've committed.
      await prisma.spoolHolder.update({
        where: { spoolHolderId: holder.spoolHolderId },
        data: { stagedSpoolId: null },
      });

      // Trigger firmware filament change:
      //   XL (replace=true)  → M1600: full unload + load with nozzle heating
      //   XL (replace=false) → M701:  load into empty slot with preheat
      //   MMU (any)          → M704:  preload to FINDA (replace flag ignored by firmware)
      const cd = progPrinter.connectionDetails;
      await triggerFilamentChange(cd, toolIndex, replace);

      // Emit incremental progress
      const afterCommit = await prisma.printer.update({
        where: { printerId },
        data: { reloadJobState: { ...progressState, done: doneIndex + 1 } },
        include: printerInclude,
      });
      getIO()?.emit('printer:updated', afterCommit);
    }

    // All done: clear reload state
    const finished = await prisma.printer.update({
      where: { printerId },
      data: { reloadJobState: null },
      include: printerInclude,
    });
    getIO()?.emit('printer:updated', finished);
  } catch (err) {
    logger.error(`[printerService] _runReloadQueue error for ${printerId}: ${err.message}`);
    // Clear stuck reloadJobState so the UI doesn't stay in "reloading" indefinitely.
    try {
      const errored = await prisma.printer.update({
        where: { printerId },
        data: { reloadJobState: null },
        include: printerInclude,
      });
      getIO()?.emit('printer:updated', errored);
    } catch (clearErr) {
      logger.error(`[printerService] failed to clear reloadJobState for ${printerId}: ${clearErr.message}`);
    }
    throw err;
  }
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
