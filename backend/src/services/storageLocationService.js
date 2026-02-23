import { PrismaClient } from '@prisma/client';
import { getIO } from '../websocket/index.js';

const prisma = new PrismaClient();

const locationInclude = {
  spools: { include: { spool: { include: { filamentType: true } }, zone: { select: { zoneId: true, name: true } } } },
  zones: {
    orderBy: { createdAt: 'asc' },
    include: { spools: { include: { spool: { include: { filamentType: true } } } } },
  },
};

export async function create(data) {
  const location = await prisma.storageLocation.create({ data, include: locationInclude });
  getIO()?.emit('storageLocation:created', location);
  return location;
}

export async function list() {
  return prisma.storageLocation.findMany({ include: locationInclude, orderBy: { name: 'asc' } });
}

export async function getById(storageLocationId) {
  return prisma.storageLocation.findUniqueOrThrow({ where: { storageLocationId }, include: locationInclude });
}

export async function update(storageLocationId, data) {
  const location = await prisma.storageLocation.update({ where: { storageLocationId }, data, include: locationInclude });
  getIO()?.emit('storageLocation:updated', location);
  return location;
}

export async function remove(storageLocationId) {
  await prisma.storageLocation.delete({ where: { storageLocationId } });
  getIO()?.emit('storageLocation:deleted', { storageLocationId });
}

export async function linkSpool(storageLocationId, spoolId) {
  await prisma.storageLocationSpool.upsert({
    where: { storageLocationId_spoolId: { storageLocationId, spoolId } },
    update: {},
    create: { storageLocationId, spoolId },
  });
  const location = await getById(storageLocationId);
  getIO()?.emit('storageLocation:updated', location);
  return location;
}

export async function unlinkSpool(storageLocationId, spoolId) {
  await prisma.storageLocationSpool.delete({
    where: { storageLocationId_spoolId: { storageLocationId, spoolId } },
  });
  const location = await getById(storageLocationId);
  getIO()?.emit('storageLocation:updated', location);
  return location;
}
