import { PrismaClient } from '@prisma/client';
import { getIO } from '../websocket/index.js';

const prisma = new PrismaClient();

const orderInclude = { filamentType: true };

export async function create(data) {
  const order = await prisma.order.create({ data, include: orderInclude });
  getIO()?.emit('order:created', order);
  return order;
}

export async function list({ status } = {}) {
  return prisma.order.findMany({
    where: { ...(status && { status }) },
    include: orderInclude,
    orderBy: { orderDate: 'desc' },
  });
}

export async function getById(orderId) {
  return prisma.order.findUniqueOrThrow({ where: { orderId }, include: orderInclude });
}

export async function update(orderId, data) {
  const order = await prisma.order.update({ where: { orderId }, data, include: orderInclude });
  getIO()?.emit('order:updated', order);
  return order;
}

export async function remove(orderId) {
  await prisma.order.delete({ where: { orderId } });
  getIO()?.emit('order:deleted', { orderId });
}

export async function triggerReorder() {
  const spoolsNeedingReorder = await prisma.spool.findMany({
    where: { orderStatus: 'REORDER_NEEDED' },
    include: { filamentType: true },
  });

  const results = [];
  for (const spool of spoolsNeedingReorder) {
    // TODO: Integrate with fulfillment APIs for one-click ordering
    results.push({
      spoolId: spool.spoolId,
      filamentType: spool.filamentType.name,
      currentWeight_g: spool.currentWeight_g,
      action: 'notification_sent',
    });
  }

  return { processed: results.length, spools: results };
}
