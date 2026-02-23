import { PrismaClient } from '@prisma/client';
import { getIO } from '../websocket/index.js';
import { updateWeight } from './spoolService.js';

const prisma = new PrismaClient();

// ── Ingest auto-sync debounce ──────────────────────────────────────────────────
// When a known spool (matched by NFC tag) is placed on an ingest holder, wait
// for the weight to stabilise before writing it back to the spool record.
// Any change (tag or weight) resets the timer; removal cancels it entirely.
const ingestDebounce = new Map(); // spoolHolderId → { nfcTagId, weight_g, timer }
const INGEST_DEBOUNCE_MS = 5000;

function scheduleSpoolWeightSync(spoolHolderId, nfcTagId, weight_g) {
  const existing = ingestDebounce.get(spoolHolderId);
  if (existing?.timer) clearTimeout(existing.timer);

  // No tag or no weight → spool removed or holder has no scale; cancel any pending sync
  if (!nfcTagId || weight_g == null) {
    ingestDebounce.delete(spoolHolderId);
    return;
  }

  const timer = setTimeout(
    () => applySpoolWeightSync(spoolHolderId, nfcTagId, weight_g),
    INGEST_DEBOUNCE_MS,
  );
  ingestDebounce.set(spoolHolderId, { nfcTagId, weight_g, timer });
}

async function applySpoolWeightSync(spoolHolderId, nfcTagId, weight_g) {
  ingestDebounce.delete(spoolHolderId);

  const spool = await prisma.spool.findUnique({
    where: { nfcTagId },
    include: { filamentType: true },
  });
  if (!spool) return; // Tag not registered to any spool — ingest flow handles new ones

  await updateWeight(spool.spoolId, weight_g);

  getIO()?.emit('ingest:spool_identified', {
    spoolHolderId,
    spoolId: spool.spoolId,
    nfcTagId,
    currentWeight_g: weight_g,
    filamentType: spool.filamentType,
  });
}

const holderInclude = {
  attachedPrinter: { select: { printerId: true, name: true } },
  storageLocation: { select: { storageLocationId: true, name: true, type: true } },
  esp32Device: { select: { deviceId: true, name: true, uniqueDeviceId: true, ipAddress: true, lastSeen: true } },
  associatedSpool: { include: { filamentType: true } },
};

export async function create(data) {
  const holder = await prisma.spoolHolder.create({ data, include: holderInclude });
  getIO()?.emit('holder:created', holder);
  return holder;
}

export async function list(filters = {}) {
  const where = {};
  if (filters.assignmentType) where.assignmentType = filters.assignmentType;
  if (filters.esp32DeviceId) where.esp32DeviceId = filters.esp32DeviceId;
  if (filters.excludeAssignmentType) where.assignmentType = { not: filters.excludeAssignmentType };
  return prisma.spoolHolder.findMany({ where, include: holderInclude, orderBy: { name: 'asc' } });
}

export async function getById(spoolHolderId) {
  return prisma.spoolHolder.findUniqueOrThrow({ where: { spoolHolderId }, include: holderInclude });
}

export async function update(spoolHolderId, data) {
  // If associatedSpoolId is being explicitly cleared, remove the spool's printer link
  if ('associatedSpoolId' in data && data.associatedSpoolId === null) {
    const existing = await prisma.spoolHolder.findUnique({
      where: { spoolHolderId },
      select: { associatedSpoolId: true },
    });
    if (existing?.associatedSpoolId) {
      await prisma.spool.update({
        where: { spoolId: existing.associatedSpoolId },
        data: { printStartWeight_g: null },
      });
    }
  }
  const holder = await prisma.spoolHolder.update({ where: { spoolHolderId }, data, include: holderInclude });
  getIO()?.emit('holder:updated', holder);
  return holder;
}

export async function remove(spoolHolderId) {
  // Clear currentPrinterId on any spool linked through this holder before deletion
  const holder = await prisma.spoolHolder.findUnique({
    where: { spoolHolderId },
    select: { associatedSpoolId: true },
  });
  if (holder?.associatedSpoolId) {
    await prisma.spool.update({
      where: { spoolId: holder.associatedSpoolId },
      data: { printStartWeight_g: null },
    });
  }
  await prisma.spoolHolder.delete({ where: { spoolHolderId } });
  getIO()?.emit('holder:deleted', { spoolHolderId });
}

export async function calibrate(spoolHolderId, { offset, scale }) {
  const holder = await prisma.spoolHolder.update({
    where: { spoolHolderId },
    data: {
      ...(offset !== undefined && { loadCellOffset: offset }),
      ...(scale !== undefined && { loadCellScale: scale }),
    },
    include: holderInclude,
  });
  getIO()?.emit('holder:updated', holder);
  return holder;
}

export async function updateSensorData(spoolHolderId, { weight_g, raw_adc, nfcTagId }) {
  const holder = await prisma.spoolHolder.update({
    where: { spoolHolderId },
    data: {
      ...(weight_g !== undefined && { currentWeight_g: weight_g }),
      ...(raw_adc !== undefined && { lastRawAdc: raw_adc }),
      ...(nfcTagId !== undefined && { nfcTagId }),
    },
    include: holderInclude,
  });

  getIO()?.emit('spool:update', {
    spoolId: holder.associatedSpoolId,
    spoolHolderId,
    currentWeight_g: weight_g,
    lastRawAdc: raw_adc,
  });

  // ── INGEST_POINT: debounce weight sync + ingest UI event ──────────────────
  if (holder.assignmentType === 'INGEST_POINT') {
    let knownSpool = null;
    if (holder.nfcTagId) {
      knownSpool = await prisma.spool.findUnique({
        where: { nfcTagId: holder.nfcTagId },
        select: {
          spoolId: true,
          initialWeight_g: true,
          currentWeight_g: true,
          filamentType: {
            select: { name: true, brand: true, material: true, color: true, colorHex: true },
          },
        },
      });
    }

    getIO()?.emit('ingest:update', {
      spoolHolderId,
      nfcTagId: holder.nfcTagId ?? null,
      currentWeight_g: holder.currentWeight_g ?? null,
      knownSpool,
    });

    scheduleSpoolWeightSync(
      spoolHolderId,
      holder.nfcTagId ?? null,
      holder.currentWeight_g ?? null,
    );
  }

  // ── PRINTER: auto-associate spool via NFC, freeze weight during printing ──
  if (holder.assignmentType === 'PRINTER') {
    // If NFC tag changed, auto-associate the matching spool
    if (nfcTagId !== undefined) {
      if (nfcTagId) {
        const spool = await prisma.spool.findUnique({ where: { nfcTagId } });
        if (spool && spool.spoolId !== holder.associatedSpoolId) {
          // Assign spool to this holder
          await prisma.spoolHolder.update({
            where: { spoolHolderId },
            data: { associatedSpoolId: spool.spoolId },
          });
          getIO()?.emit('printer:spool_loaded', {
            spoolHolderId,
            printerId: holder.attachedPrinterId,
            spoolId: spool.spoolId,
          });
        }
      } else {
        // NFC tag removed — unlink spool from holder
        if (holder.associatedSpoolId) {
          await prisma.spool.update({
            where: { spoolId: holder.associatedSpoolId },
            data: { printStartWeight_g: null },
          });
          await prisma.spoolHolder.update({
            where: { spoolHolderId },
            data: { associatedSpoolId: null },
          });
          getIO()?.emit('printer:spool_unloaded', {
            spoolHolderId,
            printerId: holder.attachedPrinterId,
          });
        }
      }
    }

    // Freeze weight update if the printer is currently PRINTING
    if (weight_g !== undefined && holder.attachedPrinterId) {
      const printer = await prisma.printer.findUnique({
        where: { printerId: holder.attachedPrinterId },
        select: { status: true },
      });
      if (printer?.status === 'PRINTING') {
        return holder; // Weight frozen during print
      }
    }
  }

  // ── Propagate weight to associated spool (STORAGE / non-printing PRINTER) ─
  if (weight_g !== undefined && holder.associatedSpoolId) {
    await updateWeight(holder.associatedSpoolId, weight_g);
  }

  return holder;
}
