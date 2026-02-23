import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

function omitPassword(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function register({ username, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, passwordHash },
  });
  return omitPassword(user);
}

export async function createUser({ username, email, password, roles }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      roles: roles ?? ['USER'],
    },
  });
  return omitPassword(user);
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const token = jwt.sign({ sub: user.userId, roles: user.roles }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  return { token, user: omitPassword(user) };
}

export async function getUserById(userId) {
  const user = await prisma.user.findUniqueOrThrow({ where: { userId } });
  return omitPassword(user);
}

export async function listUsers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  return users.map(omitPassword);
}

export async function updateUser(userId, data) {
  const { password, passwordHash, ...rest } = data;
  const updateData = { ...rest };
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
  }
  const user = await prisma.user.update({ where: { userId }, data: updateData });
  return omitPassword(user);
}

export async function deleteUser(userId) {
  await prisma.user.delete({ where: { userId } });
}

export async function findOrCreateOidcUser({ provider, providerId, email, displayName }) {
  if (!provider || !providerId) throw new Error('OIDC: missing provider or sub claim');

  // 1. Try by provider + providerId (fastest path, handles returning users)
  let user = await prisma.user.findFirst({ where: { provider, providerId } });
  if (user) return omitPassword(user);

  // 2. Try by email — only if email is a non-empty string (Prisma treats
  //    undefined as "no filter", which would match any/the first user)
  if (email && typeof email === 'string') {
    user = await prisma.user.findFirst({ where: { email } });
    if (user) {
      user = await prisma.user.update({
        where: { userId: user.userId },
        data: { provider, providerId },
      });
      return omitPassword(user);
    }
  }

  // 3. Create new user (no password for OIDC accounts)
  const base = email
    ? email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_')
    : (displayName || 'user').replace(/[^a-zA-Z0-9_]/g, '_');
  const suffix = providerId.slice(-6).replace(/[^a-zA-Z0-9]/g, '');
  const resolvedEmail = email || `${base}_${suffix}@oidc.local`;
  user = await prisma.user.create({
    data: {
      username: `${base}_${suffix}`,
      email: resolvedEmail,
      provider,
      providerId,
      roles: ['USER'],
    },
  });
  return omitPassword(user);
}
