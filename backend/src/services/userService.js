import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

function omitPassword(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

const userInclude = { customRoles: true };

export async function register({ username, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, passwordHash },
    include: userInclude,
  });
  return omitPassword(user);
}

export async function createUser({ username, email, password, roleIds }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      customRoles: roleIds?.length ? { connect: roleIds.map((id) => ({ id })) } : undefined,
    },
    include: userInclude,
  });
  return omitPassword(user);
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: userInclude,
  });
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

  const token = jwt.sign({ sub: user.userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  return { token, user: omitPassword(user) };
}

export async function getUserById(userId) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { userId },
    include: userInclude,
  });
  return omitPassword(user);
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: userInclude,
  });
  return users.map(omitPassword);
}

export async function updateUser(userId, data) {
  const { password, passwordHash, roleIds, ...rest } = data;
  const updateData = { ...rest };
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
  }
  if (roleIds !== undefined) {
    updateData.customRoles = { set: roleIds.map((id) => ({ id })) };
  }
  const user = await prisma.user.update({
    where: { userId },
    data: updateData,
    include: userInclude,
  });
  return omitPassword(user);
}

export async function deleteUser(userId) {
  await prisma.user.delete({ where: { userId } });
}

/**
 * Upsert SSO roles from OIDC claims and return an array of their IDs.
 * Each SSO role is stored with source="sso" and starts with no permissions
 * (an admin must explicitly grant permissions to each SSO group role).
 */
async function syncSsoRoles(ssoRoleNames) {
  if (!ssoRoleNames || ssoRoleNames.length === 0) return [];

  const roleIds = [];
  for (const rawName of ssoRoleNames) {
    const name = `[SSO] ${rawName}`;
    const role = await prisma.customRole.upsert({
      where: { name },
      update: {}, // never overwrite admin-configured permissions on re-login
      create: {
        name,
        description: `Auto-created from SSO group/role claim: ${rawName}`,
        permissions: [],
        source: 'sso',
      },
    });
    roleIds.push(role.id);
  }
  return roleIds;
}

export async function findOrCreateOidcUser({ provider, providerId, email, displayName, ssoRoles }) {
  if (!provider || !providerId) throw new Error('OIDC: missing provider or sub claim');

  // Upsert SSO roles so we have their IDs ready
  const ssoRoleIds = await syncSsoRoles(ssoRoles);

  // 1. Returning OIDC user — match only on provider + providerId, never on email.
  //    Email auto-linking is intentionally removed: silently taking over an existing
  //    local account (e.g. the seeded admin) when email happens to match is wrong.
  let user = await prisma.user.findFirst({
    where: { provider, providerId },
    include: userInclude,
  });

  if (user) {
    // Sync SSO roles on every login: keep manually-assigned roles, replace SSO ones
    const nonSsoRoles = user.customRoles
      .filter((r) => r.source !== 'sso')
      .map((r) => ({ id: r.id }));
    const newSet = [...nonSsoRoles, ...ssoRoleIds.map((id) => ({ id }))];
    // Only write if the set actually changed
    const currentSsoIds = user.customRoles.filter((r) => r.source === 'sso').map((r) => r.id).sort();
    const incomingSsoIds = [...ssoRoleIds].sort();
    const ssoChanged = JSON.stringify(currentSsoIds) !== JSON.stringify(incomingSsoIds);
    if (ssoChanged) {
      user = await prisma.user.update({
        where: { userId: user.userId },
        data: { customRoles: { set: newSet } },
        include: userInclude,
      });
    }
    return omitPassword(user);
  }

  // 2. First OIDC login — always create a fresh account.
  //    Username: prefer displayName, fall back to email prefix.
  const namePart = displayName
    ? displayName.replace(/[^a-zA-Z0-9_]/g, '_')
    : email
      ? email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_')
      : 'user';
  const suffix = providerId.slice(-6).replace(/[^a-zA-Z0-9]/g, '');
  // Ensure unique username by appending suffix
  const username = `${namePart}_${suffix}`;
  // Use OIDC email if provided and not already taken; otherwise generate a placeholder.
  // (A local account with the same email may exist — keep them separate.)
  let resolvedEmail = email && typeof email === 'string' ? email : null;
  if (resolvedEmail) {
    const collision = await prisma.user.findUnique({ where: { email: resolvedEmail } });
    if (collision) resolvedEmail = `${username}@oidc.local`;
  } else {
    resolvedEmail = `${username}@oidc.local`;
  }

  user = await prisma.user.create({
    data: {
      username,
      email: resolvedEmail,
      provider,
      providerId,
      customRoles: ssoRoleIds.length
        ? { connect: ssoRoleIds.map((id) => ({ id })) }
        : undefined,
    },
    include: userInclude,
  });
  return omitPassword(user);
}
