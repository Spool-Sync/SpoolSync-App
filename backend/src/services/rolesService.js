import { PrismaClient } from '@prisma/client';
import { ALL_PERMISSIONS } from '../utils/permissions.js';

const prisma = new PrismaClient();

export async function listRoles() {
  return prisma.customRole.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true } } },
  });
}

export async function getRoleById(id) {
  return prisma.customRole.findUniqueOrThrow({ where: { id } });
}

export async function createRole({ name, description, permissions }) {
  const validPerms = (permissions ?? []).filter((p) => ALL_PERMISSIONS.includes(p));
  return prisma.customRole.create({
    data: { name, description, permissions: validPerms },
  });
}

export async function updateRole(id, { name, description, permissions }) {
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (permissions !== undefined) {
    data.permissions = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
  }
  return prisma.customRole.update({ where: { id }, data });
}

export async function deleteRole(id) {
  const role = await prisma.customRole.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (role.isSystem) {
    const err = new Error('System roles cannot be deleted');
    err.status = 400;
    throw err;
  }
  if (role._count.users > 0) {
    const err = new Error('Cannot delete a role that still has users assigned');
    err.status = 400;
    throw err;
  }
  await prisma.customRole.delete({ where: { id } });
}
