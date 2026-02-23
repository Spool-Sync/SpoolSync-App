import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULTS = { favoriteBrands: [], ingestStationId: null, useIngestMode: false, defaultScaleId: null, autoOpenOnScale: true };

export async function getPreferences(userId) {
  const prefs = await prisma.userPreference.findUnique({ where: { userId } });
  return prefs ?? { ...DEFAULTS, userId };
}

export async function updatePreferences(userId, { favoriteBrands, ingestStationId, useIngestMode, defaultScaleId, autoOpenOnScale }) {
  const data = {};
  if (favoriteBrands !== undefined) data.favoriteBrands = favoriteBrands;
  if (ingestStationId !== undefined) data.ingestStationId = ingestStationId;
  if (useIngestMode !== undefined) data.useIngestMode = useIngestMode;
  if (defaultScaleId !== undefined) data.defaultScaleId = defaultScaleId;
  if (autoOpenOnScale !== undefined) data.autoOpenOnScale = autoOpenOnScale;

  return prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ...DEFAULTS, ...data },
    update: data,
  });
}
