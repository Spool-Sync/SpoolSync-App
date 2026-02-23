import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

// Module-level discovery cache: { [issuer]: discoveryDoc }
const discoveryCache = {};

export async function getConfig() {
  return prisma.oidcConfig.findFirst();
}

export async function upsertConfig({ issuer, clientId, clientSecret, enabled }) {
  const existing = await getConfig();
  const data = { issuer, clientId, enabled };
  // Only update clientSecret if a real value (not placeholder) is provided
  if (clientSecret && clientSecret !== '••••••') {
    data.clientSecret = clientSecret;
  }
  if (existing) {
    return prisma.oidcConfig.update({ where: { id: existing.id }, data });
  }
  return prisma.oidcConfig.create({
    data: { ...data, clientSecret: clientSecret || '', callbackUrl: '' },
  });
}

export async function isEnabled() {
  const config = await getConfig();
  return config?.enabled === true;
}

export async function getDiscovery(issuer) {
  if (discoveryCache[issuer]) return discoveryCache[issuer];
  const url = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OIDC discovery failed: ${response.status}`);
  const doc = await response.json();
  discoveryCache[issuer] = doc;
  return doc;
}
