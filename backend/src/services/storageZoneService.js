import { PrismaClient } from '@prisma/client';
import { getIO } from '../websocket/index.js';

const prisma = new PrismaClient();

const zoneInclude = {
  spools: {
    include: { spool: { include: { filamentType: true } } },
  },
};

function emitLocationUpdated(storageLocationId) {
  // Re-fetch and emit the parent location so the frontend stays in sync
  prisma.storageLocation
    .findUnique({
      where: { storageLocationId },
      include: { spools: { include: { spool: { include: { filamentType: true } } } }, zones: { include: zoneInclude } },
    })
    .then((loc) => { if (loc) getIO()?.emit('storageLocation:updated', loc); })
    .catch(() => {});
}

export async function list(storageLocationId) {
  return prisma.storageZone.findMany({
    where: { storageLocationId },
    include: zoneInclude,
    orderBy: { createdAt: 'asc' },
  });
}

export async function create(storageLocationId, data) {
  const zone = await prisma.storageZone.create({
    data: { storageLocationId, ...data },
    include: zoneInclude,
  });
  emitLocationUpdated(storageLocationId);
  return zone;
}

export async function update(zoneId, data) {
  const zone = await prisma.storageZone.update({
    where: { zoneId },
    data,
    include: zoneInclude,
  });
  emitLocationUpdated(zone.storageLocationId);
  return zone;
}

export async function remove(zoneId) {
  const zone = await prisma.storageZone.findUniqueOrThrow({ where: { zoneId }, select: { storageLocationId: true } });
  // Move all spools in this zone to no zone (keep them in the location)
  await prisma.storageLocationSpool.updateMany({
    where: { zoneId },
    data: { zoneId: null },
  });
  await prisma.storageZone.delete({ where: { zoneId } });
  emitLocationUpdated(zone.storageLocationId);
}

/** Assign a spool to a zone (and the zone's parent location if not already there). */
export async function assignSpoolToZone(zoneId, spoolId) {
  const zone = await prisma.storageZone.findUniqueOrThrow({
    where: { zoneId },
    select: { storageLocationId: true },
  });

  // Upsert the location→spool link with the zone set
  await prisma.storageLocationSpool.upsert({
    where: { storageLocationId_spoolId: { storageLocationId: zone.storageLocationId, spoolId } },
    update: { zoneId },
    create: { storageLocationId: zone.storageLocationId, spoolId, zoneId },
  });

  emitLocationUpdated(zone.storageLocationId);
}

/** Remove a spool from a zone (keeps the spool in the location, zone becomes null). */
export async function removeSpoolFromZone(zoneId, spoolId) {
  const zone = await prisma.storageZone.findUniqueOrThrow({
    where: { zoneId },
    select: { storageLocationId: true },
  });

  await prisma.storageLocationSpool.update({
    where: { storageLocationId_spoolId: { storageLocationId: zone.storageLocationId, spoolId } },
    data: { zoneId: null },
  });

  emitLocationUpdated(zone.storageLocationId);
}
