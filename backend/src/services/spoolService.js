import { PrismaClient } from '@prisma/client';
import { getIO } from '../websocket/index.js';

const prisma = new PrismaClient();

const spoolInclude = {
  filamentType: true,
  spoolHolder: {
    select: {
      spoolHolderId: true,
      name: true,
      currentWeight_g: true,
      attachedPrinterId: true,
      attachedPrinter: { select: { printerId: true, name: true, status: true } },
    },
  },
  storageLocations: { include: { storageLocation: true } },
};

export async function create(data) {
  // Strip form-only fields that don't belong on the Spool model
  const { filamentTypeData, reorderThreshold, storageLocationId, filamentTypeSpoolWeight_g, filamentTypeReorderThreshold_g, ...spoolData } = data;

  let { filamentTypeId } = spoolData;

  // If no DB record yet (OFDB live data), find or create the filament type
  if (!filamentTypeId && filamentTypeData) {
    const existing = await prisma.filamentType.findFirst({
      where: {
        brand: filamentTypeData.brand,
        name: filamentTypeData.name,
        material: filamentTypeData.material,
        color: filamentTypeData.color ?? null,
      },
    });
    if (existing) {
      filamentTypeId = existing.filamentTypeId;
      const ftUpdates = {};
      if (filamentTypeData.spoolWeight_g !== undefined) ftUpdates.spoolWeight_g = filamentTypeData.spoolWeight_g;
      if (filamentTypeReorderThreshold_g !== undefined) ftUpdates.reorderThreshold_g = filamentTypeReorderThreshold_g;
      if (Object.keys(ftUpdates).length) {
        await prisma.filamentType.update({ where: { filamentTypeId }, data: ftUpdates });
      }
    } else {
      filamentTypeId = (
        await prisma.filamentType.create({
          data: {
            brand: filamentTypeData.brand,
            name: filamentTypeData.name,
            material: filamentTypeData.material,
            color: filamentTypeData.color ?? null,
            colorHex: filamentTypeData.colorHex ?? null,
            diameter_mm: filamentTypeData.diameter_mm ?? 1.75,
            density_g_cm3: filamentTypeData.density_g_cm3 ?? null,
            spoolWeight_g: filamentTypeData.spoolWeight_g ?? 200,
            reorderThreshold_g: filamentTypeReorderThreshold_g ?? null,
            custom: false,
          },
        })
      ).filamentTypeId;
    }
  }

  const spool = await prisma.spool.create({
    data: {
      ...spoolData,
      filamentTypeId,
      nfcTagId: spoolData.nfcTagId?.toLowerCase() || null,
      currentWeight_g: spoolData.currentWeight_g ?? spoolData.initialWeight_g,
    },
    include: spoolInclude,
  });

  // Log initial weight to history
  await prisma.weightHistory.create({
    data: { spoolId: spool.spoolId, weight_g: spool.currentWeight_g, source: 'manual' },
  });

  if (storageLocationId) {
    await prisma.storageLocationSpool.create({
      data: { storageLocationId, spoolId: spool.spoolId },
    });
    const full = await getById(spool.spoolId);
    getIO()?.emit('spool:created', full);
    return full;
  }
  getIO()?.emit('spool:created', spool);
  return spool;
}

export async function list({ locationId, printerId, orderStatus, search, material, color, page, pageSize, sortBy, sortOrder } = {}) {
  const pg = parseInt(page) || 1;
  const ps = Math.min(parseInt(pageSize) || 25, 200);

  const allowedSortFields = { weight: 'currentWeight_g', createdAt: 'createdAt' };
  const orderByField = allowedSortFields[sortBy] ?? 'createdAt';
  const orderByDir = sortOrder === 'asc' ? 'asc' : 'desc';

  const filamentTypeFilter = {
    ...(material && { material }),
    ...(color && { color }),
  };

  const where = {
    ...(printerId && { spoolHolder: { attachedPrinterId: printerId } }),
    ...(orderStatus && { orderStatus }),
    ...(locationId && { storageLocations: { some: { storageLocationId: locationId } } }),
    ...(Object.keys(filamentTypeFilter).length && { filamentType: filamentTypeFilter }),
    ...(search && {
      OR: [
        { filamentType: { brand: { contains: search, mode: 'insensitive' } } },
        { filamentType: { name: { contains: search, mode: 'insensitive' } } },
        { filamentType: { material: { contains: search, mode: 'insensitive' } } },
        { filamentType: { color: { contains: search, mode: 'insensitive' } } },
        { nfcTagId: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.spool.findMany({
      where,
      include: spoolInclude,
      orderBy: { [orderByField]: orderByDir },
      skip: (pg - 1) * ps,
      take: ps,
    }),
    prisma.spool.count({ where }),
  ]);

  return { items, total, page: pg, pageSize: ps };
}

export async function listFilters() {
  const [materials, colors] = await Promise.all([
    prisma.filamentType.findMany({ distinct: ['material'], select: { material: true }, orderBy: { material: 'asc' } }),
    prisma.filamentType.findMany({
      distinct: ['color', 'colorHex'],
      select: { color: true, colorHex: true },
      where: { color: { not: null } },
      orderBy: { color: 'asc' },
    }),
  ]);
  return {
    materials: materials.map(m => m.material),
    colors: colors.map(c => ({ color: c.color, colorHex: c.colorHex })),
  };
}

export async function getById(spoolId) {
  return prisma.spool.findUniqueOrThrow({ where: { spoolId }, include: spoolInclude });
}

export async function findByNfcTag(nfcTagId) {
  return prisma.spool.findUnique({ where: { nfcTagId }, include: spoolInclude });
}

export async function update(spoolId, data) {
  const {
    storageLocationId,
    filamentTypeData,
    reorderThreshold,
    filamentTypeSpoolWeight_g,
    filamentTypeReorderThreshold_g,
    ...spoolData
  } = data;

  // Track weight change before applying update
  const prevWeight = spoolData.currentWeight_g !== undefined
    ? (await prisma.spool.findUnique({ where: { spoolId }, select: { currentWeight_g: true } }))?.currentWeight_g
    : undefined;

  if ('nfcTagId' in spoolData) spoolData.nfcTagId = spoolData.nfcTagId?.toLowerCase() || null;
  await prisma.spool.update({ where: { spoolId }, data: spoolData });

  // storageLocationId === undefined means "not touched"; null means "clear"
  if (storageLocationId !== undefined) {
    await prisma.storageLocationSpool.deleteMany({ where: { spoolId } });
    if (storageLocationId) {
      await prisma.storageLocationSpool.create({ data: { storageLocationId, spoolId } });
    }
  }

  // Persist filament-type-level fields if provided
  if (filamentTypeSpoolWeight_g !== undefined || filamentTypeReorderThreshold_g !== undefined) {
    const current = await prisma.spool.findUnique({ where: { spoolId }, select: { filamentTypeId: true } });
    if (current?.filamentTypeId) {
      await prisma.filamentType.update({
        where: { filamentTypeId: current.filamentTypeId },
        data: {
          ...(filamentTypeSpoolWeight_g !== undefined && { spoolWeight_g: filamentTypeSpoolWeight_g }),
          ...(filamentTypeReorderThreshold_g !== undefined && { reorderThreshold_g: filamentTypeReorderThreshold_g }),
        },
      });
    }
  }

  // Log manual weight change to history
  if (spoolData.currentWeight_g !== undefined && spoolData.currentWeight_g !== prevWeight) {
    await prisma.weightHistory.create({
      data: { spoolId, weight_g: spoolData.currentWeight_g, source: 'manual' },
    });
  }

  // Emit once after all DB changes so WS carries the complete, up-to-date record
  const final = await getById(spoolId);
  getIO()?.emit('spool:update', final);
  return final;
}

export async function remove(spoolId) {
  // Use a transaction to ensure both deletes happen or neither do.
  await prisma.$transaction([
    // First, delete all links in the join table for this spool
    prisma.storageLocationSpool.deleteMany({ where: { spoolId } }),
    // Then, delete the spool itself
    prisma.spool.delete({ where: { spoolId } }),
  ]);
  getIO()?.emit('spool:deleted', { spoolId });
}

export async function associateLocation(spoolId, { storageLocationId, spoolHolderId, type }) {
  // type: 'storage' | 'holder'
  if (type === 'storage' && storageLocationId) {
    await prisma.storageLocationSpool.upsert({
      where: { storageLocationId_spoolId: { storageLocationId, spoolId } },
      update: {},
      create: { storageLocationId, spoolId },
    });
  }
  const spool = await getById(spoolId);
  getIO()?.emit('spool:updated', spool);
  return spool;
}

export async function updateWeight(spoolId, weight_g, source = 'scale') {
  const spool = await prisma.spool.update({
    where: { spoolId },
    data: { currentWeight_g: weight_g },
    include: spoolInclude,
  });

  // Log to weight history
  await prisma.weightHistory.create({ data: { spoolId, weight_g, source } });

  getIO()?.emit('spool:update', { spoolId, currentWeight_g: weight_g });

  // Check reorder threshold (now on filamentType)
  const threshold = spool.filamentType?.reorderThreshold_g;
  if (threshold && weight_g <= threshold && spool.orderStatus === 'IN_STOCK') {
    await prisma.spool.update({ where: { spoolId }, data: { orderStatus: 'REORDER_NEEDED' } });
    getIO()?.emit('inventory:low_stock_alert', { spoolId, currentWeight_g: weight_g });
  }

  // Auto-mark as SPENT when filament is exhausted (weight ≤ spool shell weight)
  const spoolWeight = spool.filamentType?.spoolWeight_g ?? 200;
  const filamentRemaining = weight_g - spoolWeight;
  if (filamentRemaining <= 0 && spool.status === 'ACTIVE') {
    const spentSpool = await prisma.spool.update({
      where: { spoolId },
      data: { status: 'SPENT' },
      include: spoolInclude,
    });
    getIO()?.emit('spool:updated', spentSpool);
    return spentSpool;
  }

  return spool;
}

/** Manually mark a spool as spent or active. */
export async function markSpent(spoolId, spent = true) {
  const spool = await prisma.spool.update({
    where: { spoolId },
    data: { status: spent ? 'SPENT' : 'ACTIVE' },
    include: spoolInclude,
  });
  getIO()?.emit('spool:updated', spool);
  return spool;
}

/** Refill a spent spool: reset weight to full and reactivate. */
export async function refill(spoolId, { filamentTypeId, initialWeight_g } = {}) {
  const existing = await prisma.spool.findUniqueOrThrow({ where: { spoolId }, include: { filamentType: true } });
  const newFilamentTypeId = filamentTypeId ?? existing.filamentTypeId;
  const newInitialWeight = initialWeight_g ?? existing.initialWeight_g;

  const spool = await prisma.spool.update({
    where: { spoolId },
    data: {
      status: 'ACTIVE',
      filamentTypeId: newFilamentTypeId,
      initialWeight_g: newInitialWeight,
      currentWeight_g: newInitialWeight,
      printStartWeight_g: null,
    },
    include: spoolInclude,
  });

  await prisma.weightHistory.create({ data: { spoolId, weight_g: newInitialWeight, source: 'refill' } });
  getIO()?.emit('spool:updated', spool);
  return spool;
}

export async function updateStatus(spoolId, orderStatus) {
  return update(spoolId, { orderStatus });
}

export async function setInitialWeight(spoolId, weight_g) {
  const spool = await prisma.spool.update({
    where: { spoolId },
    data: { initialWeight_g: weight_g, currentWeight_g: weight_g },
    include: spoolInclude,
  });
  await prisma.weightHistory.create({ data: { spoolId, weight_g, source: 'ingest' } });
  getIO()?.emit('spool:update', { spoolId, currentWeight_g: weight_g });
  return spool;
}

export async function getHistory(spoolId, days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return prisma.weightHistory.findMany({
    where: { spoolId, recordedAt: { gte: since } },
    orderBy: { recordedAt: 'asc' },
    select: { id: true, weight_g: true, source: true, recordedAt: true },
  });
}

// Returns daily total filament remaining (sum across all spools) for the last N days.
// Uses the latest WeightHistory reading per spool per day, then sums.
export async function getUsageTrend(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get all history records within the window plus spool core weights
  const rows = await prisma.$queryRaw`
    SELECT
      DATE_TRUNC('day', wh."recordedAt") AS day,
      SUM(GREATEST(0, wh.weight_g - COALESCE(ft."spoolWeight_g", 200))) AS total_filament_g
    FROM weight_history wh
    JOIN spools s ON s."spoolId" = wh."spoolId"
    JOIN filament_types ft ON ft."filamentTypeId" = s."filamentTypeId"
    WHERE wh."recordedAt" >= ${since}
    GROUP BY DATE_TRUNC('day', wh."recordedAt")
    ORDER BY day ASC
  `;

  return rows.map(r => ({
    date: r.day.toISOString().slice(0, 10),
    total_g: Math.round(Number(r.total_filament_g)),
  }));
}

// Returns daily filament remaining per filament type for the last N days.
// Each entry has a label, colorHex, and a data array of { date, total_g }.
export async function getUsageTrendByType(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await prisma.$queryRaw`
    SELECT
      DATE_TRUNC('day', wh."recordedAt") AS day,
      ft."filamentTypeId",
      ft.brand,
      ft.name,
      ft."colorHex",
      ft.color,
      SUM(GREATEST(0, wh.weight_g - COALESCE(ft."spoolWeight_g", 200))) AS total_filament_g
    FROM weight_history wh
    JOIN spools s ON s."spoolId" = wh."spoolId"
    JOIN filament_types ft ON ft."filamentTypeId" = s."filamentTypeId"
    WHERE wh."recordedAt" >= ${since}
    GROUP BY DATE_TRUNC('day', wh."recordedAt"), ft."filamentTypeId", ft.brand, ft.name, ft."colorHex", ft.color
    ORDER BY ft."filamentTypeId", day ASC
  `;

  // Group flat rows into per-type series
  const seriesMap = {};
  for (const r of rows) {
    const id = r.filamentTypeId;
    if (!seriesMap[id]) {
      seriesMap[id] = {
        filamentTypeId: id,
        label: `${r.brand} ${r.name}${r.color ? ` (${r.color})` : ''}`,
        colorHex: r.colorHex || null,
        data: [],
      };
    }
    seriesMap[id].data.push({
      date: r.day.toISOString().slice(0, 10),
      total_g: Math.round(Number(r.total_filament_g)),
    });
  }

  return Object.values(seriesMap);
}

export async function linkNfcTag(spoolId, nfcTagId) {
  const spool = await prisma.spool.update({
    where: { spoolId },
    data: { nfcTagId: nfcTagId?.toLowerCase() || null },
    include: spoolInclude,
  });
  getIO()?.emit('spool:updated', spool);
  return spool;
}
