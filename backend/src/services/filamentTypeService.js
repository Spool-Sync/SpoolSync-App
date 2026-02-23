import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import { getIO } from "../websocket/index.js";

const prisma = new PrismaClient();
const OFDB_BASE = "https://api.openfilamentdatabase.org/api/v1";

// Get unique brands (manufacturers)
export async function listBrands() {
  const res = await fetch(`${OFDB_BASE}/brands/index.json`);
  if (!res.ok)
    throw new Error("Failed to fetch brands from Open Filament Database");
  const { brands } = await res.json();
  return brands
    .map((b) => b.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

// Get unique material types for a brand
export async function listMaterialTypes(brand) {
  const res = await fetch(`${OFDB_BASE}/brands/index.json`);
  if (!res.ok)
    throw new Error("Failed to fetch brands from Open Filament Database");
  const { brands } = await res.json();
  const brandObj = brands.find(
    (b) => b.name.toLowerCase() === brand.toLowerCase(),
  );
  if (!brandObj) return [];
  const brandDetailRes = await fetch(
    `${OFDB_BASE}/brands/${brandObj.slug}/index.json`,
  );
  if (!brandDetailRes.ok)
    throw new Error(
      "Failed to fetch brand details from Open Filament Database",
    );
  const brandData = await brandDetailRes.json();
  return (brandData.materials || [])
    .map((m) => m.material)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

// Get unique material names for a brand and material type
export async function listMaterials(brand, materialType) {
  const brandsRes = await fetch(`${OFDB_BASE}/brands/index.json`);
  if (!brandsRes.ok)
    throw new Error("Failed to fetch brands from Open Filament Database");
  const { brands } = await brandsRes.json();
  const brandObj = brands.find(
    (b) => b.name.toLowerCase() === brand.toLowerCase(),
  );
  if (!brandObj) return [];
  const brandDetailRes = await fetch(
    `${OFDB_BASE}/brands/${brandObj.slug}/index.json`,
  );
  if (!brandDetailRes.ok)
    throw new Error(
      "Failed to fetch brand details from Open Filament Database",
    );
  const brandData = await brandDetailRes.json();
  const materialObj = (brandData.materials || []).find(
    (m) => m.material.toLowerCase() === materialType.toLowerCase(),
  );
  if (!materialObj) return [];
  const filamentsRes = await fetch(
    `${OFDB_BASE}/brands/${brandObj.slug}/materials/${materialObj.slug}/index.json`,
  );
  if (!filamentsRes.ok) return [];
  const filamentsData = await filamentsRes.json();
  return (filamentsData.filaments || [])
    .map((f) => f.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export async function create(data) {
  const filamentType = await prisma.filamentType.create({ data: { ...data, custom: true } });
  getIO()?.emit("filamentType:created", filamentType);
  return filamentType;
}

export async function list({ brand, material, name, custom } = {}) {
  // If both brand and material are provided, fetch from Open Filament Database API
  if (brand && material && !custom) {
    const brandsRes = await fetch(`${OFDB_BASE}/brands/index.json`);
    if (!brandsRes.ok)
      throw new Error("Failed to fetch brands from Open Filament Database");
    const { brands } = await brandsRes.json();
    const brandObj = brands.find(
      (b) => b.name.toLowerCase() === brand.toLowerCase(),
    );
    if (!brandObj) return [];
    const brandDetailRes = await fetch(
      `${OFDB_BASE}/brands/${brandObj.slug}/index.json`,
    );
    if (!brandDetailRes.ok)
      throw new Error(
        "Failed to fetch brand details from Open Filament Database",
      );
    const brandData = await brandDetailRes.json();
    const materialObj = (brandData.materials || []).find(
      (m) => m.material.toLowerCase() === material.toLowerCase(),
    );
    if (!materialObj) return [];
    const filamentsRes = await fetch(
      `${OFDB_BASE}/brands/${brandObj.slug}/materials/${materialObj.slug}/index.json`,
    );
    if (!filamentsRes.ok) return [];
    const filamentsData = await filamentsRes.json();
    const filamentList = filamentsData.filaments || [];

    if (name) {
      // Fetch the individual filament's detail to get color variants
      const filamentEntry = filamentList.find((f) => f.name === name);
      if (!filamentEntry) return [];
      const detailRes = await fetch(
        `${OFDB_BASE}/brands/${brandObj.slug}/materials/${materialObj.slug}/filaments/${filamentEntry.slug}/index.json`,
      );
      if (!detailRes.ok) return [];
      const detail = await detailRes.json();
      const variants = detail.variants?.length
        ? detail.variants
        : [{ color_name: null, color_hex: null }];
      return variants.map((v) => ({
        name: detail.name,
        brand: brandObj.name,
        material: materialObj.material,
        color: v.color_name || null,
        colorHex: v.color_hex || null,
        diameter_mm: 1.75,
        density_g_cm3: detail.density || null,
        custom: false,
      }));
    }

    return filamentList
      .map((f) => ({
        name: f.name,
        brand: brandObj.name,
        material: materialObj.material,
        color: null,
        colorHex: null,
        diameter_mm: 1.75,
        density_g_cm3: null,
        custom: false,
      }))
      .filter((f) => f.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  // Otherwise, fallback to local DB
  return prisma.filamentType.findMany({
    where: {
      ...(brand && { brand: { contains: brand, mode: "insensitive" } }),
      ...(material && {
        material: { contains: material, mode: "insensitive" },
      }),
      ...(name && { name: { contains: name, mode: "insensitive" } }),
      ...(custom !== undefined && { custom: custom === "true" }),
    },
    orderBy: [{ brand: "asc" }, { name: "asc" }],
  });
}

export async function getById(filamentTypeId) {
  return prisma.filamentType.findUniqueOrThrow({ where: { filamentTypeId } });
}

export async function update(filamentTypeId, data) {
  const filamentType = await prisma.filamentType.update({ where: { filamentTypeId }, data });
  getIO()?.emit("filamentType:updated", filamentType);
  return filamentType;
}

export async function remove(filamentTypeId) {
  await prisma.filamentType.delete({ where: { filamentTypeId } });
  getIO()?.emit("filamentType:deleted", { filamentTypeId });
}

export async function search(query) {
  if (!query) return list();

  return prisma.filamentType.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
        { material: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [{ brand: "asc" }, { name: "asc" }],
    take: 50,
  });
}

/**
 * Syncs filament data from the Open Filament Database (api.openfilamentdatabase.org).
 *
 * API hierarchy:
 *   /brands/index.json
 *     → /brands/{slug}/materials/{mat}/filaments/{fil}/index.json
 *       → filament has: name, material, density, variants[{ color_name, color_hex }]
 *
 * Each variant becomes one FilamentType record (brand + filament name + color).
 * Diameter defaults to 1.75mm (most common); can be overridden manually.
 * Uses sourceApiId to avoid duplicates on re-sync.
 */
export async function syncExternal() {
  const brandsRes = await fetch(`${OFDB_BASE}/brands/index.json`);
  if (!brandsRes.ok)
    throw new Error("Failed to fetch brands from Open Filament Database");

  const { brands } = await brandsRes.json();
  let synced = 0;
  let skipped = 0;

  for (const brand of brands) {
    if (brand.material_count === 0) continue;

    let brandData;
    try {
      const brandRes = await fetch(
        `${OFDB_BASE}/brands/${brand.slug}/index.json`,
      );
      if (!brandRes.ok) continue;
      brandData = await brandRes.json();
    } catch {
      continue;
    }

    for (const materialEntry of brandData.materials || []) {
      for (const filamentEntry of await fetchFilamentList(
        brand.slug,
        materialEntry.slug,
      )) {
        let filamentData;
        try {
          const filRes = await fetch(
            `${OFDB_BASE}/brands/${brand.slug}/materials/${materialEntry.slug}/filaments/${filamentEntry.slug}/index.json`,
          );
          if (!filRes.ok) continue;
          filamentData = await filRes.json();
        } catch {
          continue;
        }

        const variants = filamentData.variants?.length
          ? filamentData.variants
          : [{ color_name: null, color_hex: null, id: filamentData.id }];

        for (const variant of variants) {
          const sourceApiId =
            variant.id || `${filamentData.id}-${variant.slug}`;

          const existing = await prisma.filamentType.findFirst({
            where: { sourceApiId },
          });
          if (existing) {
            skipped++;
            continue;
          }

          await prisma.filamentType.create({
            data: {
              name: filamentData.name,
              brand: brandData.name,
              material: filamentData.material,
              color: variant.color_name || null,
              colorHex: variant.color_hex || null,
              diameter_mm: 1.75,
              density_g_cm3: filamentData.density || null,
              sourceApiId,
              custom: false,
            },
          });
          synced++;
        }
      }
    }
  }

  return {
    synced,
    skipped,
    message: `Synced ${synced} filament variants, skipped ${skipped} existing.`,
  };
}

async function fetchFilamentList(brandSlug, materialSlug) {
  try {
    const res = await fetch(
      `${OFDB_BASE}/brands/${brandSlug}/materials/${materialSlug}/index.json`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.filaments || [];
  } catch {
    return [];
  }
}
