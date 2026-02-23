import { decode, decodeMultiple } from 'cbor-x';

export const MIME_TYPE = 'application/vnd.openprinttag';

// material_type enum key → abbreviation (from OpenPrintTag spec)
const MATERIAL_TYPES = {
  0: 'PLA', 1: 'PETG', 2: 'TPU', 3: 'ABS', 4: 'ASA', 5: 'PC',
  6: 'PCTG', 7: 'PP', 8: 'PA6', 9: 'PA11', 10: 'PA12', 11: 'PA66',
  12: 'CPE', 13: 'TPE', 14: 'HIPS', 15: 'PHA', 16: 'PET', 17: 'PEI',
  18: 'PBT', 19: 'PVB', 20: 'PVA', 21: 'PEKK', 22: 'PEEK', 23: 'BVOH',
  24: 'TPC', 25: 'PPS', 26: 'PPSU', 27: 'PVC', 28: 'PEBA', 29: 'PVDF',
  30: 'PPA', 31: 'PCL', 32: 'PES', 33: 'PMMA', 34: 'POM', 35: 'PPE',
  36: 'PS', 37: 'PSU', 38: 'TPI', 39: 'SBS', 40: 'OBC', 41: 'EVA',
};

export function isOpenPrintTag(record) {
  return record.recordType === 'mime' && record.mediaType === MIME_TYPE;
}

/** Convert 3–4 RGBA bytes to '#rrggbb' hex string */
function bytesToHex(bytes) {
  if (!bytes || bytes.length < 3) return null;
  return '#' + Array.from(bytes.slice(0, 3))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Get a field from a decoded CBOR map (plain object or Map). */
function get(map, key) {
  if (!map) return undefined;
  if (map instanceof Map) return map.get(key);
  return map[key];
}

function extractFields(main, aux) {
  const brand        = get(main, 11) ?? null;   // brand_name
  const name         = get(main, 10) ?? null;   // material_name (e.g. "PLA Galaxy Black")
  const matTypeKey   = get(main, 9);
  const material     = matTypeKey != null ? (MATERIAL_TYPES[matTypeKey] ?? null) : null;

  const colorBytes   = get(main, 19);           // primary_color (RGBA bytes)
  const colorHex     = colorBytes ? bytesToHex(colorBytes) : null;

  const nominalWeight = get(main, 16);          // nominal_netto_full_weight (g)
  const actualWeight  = get(main, 17);          // actual_netto_full_weight (g)
  const spoolWeight_g = get(main, 18) ?? null;  // empty_container_weight (g)

  const nozzleTempMin = get(main, 34) ?? null;  // min_print_temperature (°C)
  const nozzleTempMax = get(main, 35) ?? null;  // max_print_temperature (°C)
  const bedTempMin    = get(main, 37) ?? null;  // min_bed_temperature (°C)
  const bedTempMax    = get(main, 38) ?? null;  // max_bed_temperature (°C)
  const diameter_mm   = get(main, 30) ?? 1.75;  // filament_diameter (mm)
  const density_g_cm3 = get(main, 29) ?? null;  // density (g/cm³)

  const nettoWeight_g    = actualWeight ?? nominalWeight ?? null;
  const consumedWeight_g = get(aux, 0) ?? 0;    // aux key 0 = consumed_weight (g)
  const currentWeight_g  = nettoWeight_g != null
    ? Math.max(0, nettoWeight_g - consumedWeight_g)
    : null;

  // Total weight that would show on a scale = filament + spool
  const totalWeight_g = (nettoWeight_g != null && spoolWeight_g != null)
    ? nettoWeight_g + spoolWeight_g
    : nettoWeight_g;

  return {
    brand,
    name,
    material,
    colorHex,
    nozzleTempMin,
    nozzleTempMax,
    bedTempMin,
    bedTempMax,
    diameter_mm,
    density_g_cm3,
    spoolWeight_g,
    nettoWeight_g,
    consumedWeight_g,
    currentWeight_g,
    totalWeight_g,
  };
}

/**
 * Parse an NDEF record that has been identified as an OpenPrintTag.
 * Returns a structured object with all extracted filament fields, or null on failure.
 */
export function parseOpenPrintTag(record) {
  try {
    const bytes = new Uint8Array(record.data);

    // Decode meta section (the first CBOR item in the payload)
    const meta = decode(bytes);

    let main = null;
    let aux  = null;

    const mainOffset = get(meta, 0); // key 0 = main_region_offset (absolute, from payload start)
    const auxOffset  = get(meta, 2); // key 2 = aux_region_offset

    if (typeof mainOffset === 'number') {
      // Meta specifies explicit offsets — use them
      main = decode(bytes.slice(mainOffset));
      if (typeof auxOffset === 'number') {
        aux = decode(bytes.slice(auxOffset));
      }
    } else {
      // No explicit offsets: sections are packed consecutively → [meta, main, aux?]
      const items = decodeMultiple(bytes);
      if (items && items.length >= 2) {
        main = items[1];
        aux  = items[2] ?? null;
      }
    }

    if (!main) return null;
    return extractFields(main, aux);
  } catch (err) {
    console.error('[OpenPrintTag] parse error:', err);
    return null;
  }
}
