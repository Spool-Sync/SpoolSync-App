/**
 * SpoolSync Firmware Service
 *
 * Handles communication with printers running PrusaLink with the custom
 * SpoolSync firmware (prusalink_buddy integration type). Provides functions to:
 *   - Enable/disable SpoolSync mode on the printer
 *   - Push filament type assignments to the printer
 *   - Fetch printer capabilities (extruder count)
 */

import logger from '../middleware/logger.js';

const INTEGRATION_TYPE = 'prusalink_buddy';
const REQUEST_TIMEOUT_MS = 5000;
const DETECT_TIMEOUT_MS = 3000;

// Firmware preset names (must be ≤7 chars, exact case). Longer/more-specific first
// so "PETG" beats "PET". Only used as a fallback when no temperature data is available.
const FIRMWARE_PRESET_NAMES = ['PETG', 'PLA', 'ASA', 'ABS', 'HIPS', 'FLEX', 'PA', 'PC', 'PP', 'PVB'];

/**
 * Map a material name to a firmware preset name via substring matching.
 * Returns the preset name on match, or empty string if nothing matches.
 * Only used when no temperature data is available to create a user profile.
 */
function findPresetMatch(material) {
  if (!material) return '';
  const upper = material.toUpperCase().trim();
  for (const preset of FIRMWARE_PRESET_NAMES) {
    if (upper === preset || upper.includes(preset)) return preset;
  }
  return '';
}


/**
 * Returns true if the given printer uses the prusalink_buddy integration.
 * @param {object} printer - Printer record from Prisma
 */
export function isBuddyPrinter(printer) {
  return printer.type === INTEGRATION_TYPE;
}

/**
 * Build authorization headers for a prusalink_buddy printer.
 * @param {object} connectionDetails
 */
function buildHeaders(connectionDetails) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(connectionDetails.apiKey ? { 'X-Api-Key': connectionDetails.apiKey } : {}),
  };
}

/**
 * Probe a PrusaLink printer to see if it's running the custom SpoolSync firmware.
 *
 * The custom firmware is the only one that exposes GET /api/v1/settings and
 * returns a JSON body containing `spoolsync_enabled`. Standard PrusaLink
 * firmware returns 404 for that path.
 *
 * Returns true if the custom firmware is detected, false otherwise.
 */
export async function detectCustomFirmware(connectionDetails) {
  try {
    const url = `${connectionDetails.base_url}/api/v1/settings`;
    const res = await fetch(url, {
      headers: buildHeaders(connectionDetails),
      signal: AbortSignal.timeout(DETECT_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const body = await res.json();
    return typeof body?.spoolsync_enabled === 'boolean';
  } catch {
    return false;
  }
}

/**
 * Fetch printer info from the firmware, including extruder_count.
 * Returns null on failure.
 */
export async function fetchPrinterInfo(connectionDetails) {
  try {
    const url = `${connectionDetails.base_url}/api/v1/info`;
    const res = await fetch(url, {
      headers: buildHeaders(connectionDetails),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    logger.warn(`[spoolSyncFirmware] fetchPrinterInfo failed: ${err.message}`);
    return null;
  }
}

/**
 * Enable or disable SpoolSync mode on the printer firmware.
 * Failure is non-fatal (logged as warning).
 */
export async function setSpoolSyncEnabled(connectionDetails, enabled) {
  try {
    const url = `${connectionDetails.base_url}/api/v1/settings`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: buildHeaders(connectionDetails),
      body: JSON.stringify({ spoolsync_enabled: enabled }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.info(`[spoolSyncFirmware] spoolsync_enabled=${enabled} set on ${connectionDetails.base_url}`);
  } catch (err) {
    logger.warn(`[spoolSyncFirmware] setSpoolSyncEnabled failed: ${err.message}`);
  }
}

/**
 * Configure the syslog destination on a buddy printer.
 * Sends PUT /api/v1/settings with syslog_host and syslog_enabled=true.
 * The host must be a hostname or IP reachable from the printer's network.
 * Non-fatal — failure is logged as a warning.
 */
export async function configureSyslog(connectionDetails, syslogHost) {
  try {
    const url = `${connectionDetails.base_url}/api/v1/settings`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: buildHeaders(connectionDetails),
      body: JSON.stringify({ syslog_host: syslogHost, syslog_enabled: true }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.info(`[spoolSyncFirmware] syslog configured → ${syslogHost} on ${connectionDetails.base_url}`);
  } catch (err) {
    logger.warn(`[spoolSyncFirmware] configureSyslog failed: ${err.message}`);
  }
}

/**
 * Trigger a filament change for a specific tool on the firmware.
 * Sends POST /api/v1/filament/change { tool, replace }.
 *   replace=true  → XL: M1600 (full unload + load with nozzle heating); MMU: M704
 *   replace=false → XL: M701  (load into empty slot with preheat);      MMU: M704
 * Returns true on 2xx, false on failure (non-fatal).
 */
export async function triggerFilamentChange(connectionDetails, toolIndex, replace) {
  try {
    const url = `${connectionDetails.base_url}/api/v1/filament/change`;
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(connectionDetails),
      body: JSON.stringify({ tool: toolIndex, replace }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.info(`[spoolSyncFirmware] filament change triggered tool=${toolIndex} replace=${replace} on ${connectionDetails.base_url}`);
    return true;
  } catch (err) {
    logger.warn(`[spoolSyncFirmware] triggerFilamentChange failed: ${err.message}`);
    return false;
  }
}

/**
 * Trigger a physical filament load for a specific tool on the firmware.
 * Sends POST /api/v1/filament/load and returns true on 2xx, false on failure.
 * Non-fatal — caller should not throw on false.
 */
export async function triggerFilamentLoad(connectionDetails, toolIndex) {
  try {
    const url = `${connectionDetails.base_url}/api/v1/filament/load`;
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(connectionDetails),
      body: JSON.stringify({ tool: toolIndex }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.info(`[spoolSyncFirmware] filament load triggered tool=${toolIndex} on ${connectionDetails.base_url}`);
    return true;
  } catch (err) {
    logger.warn(`[spoolSyncFirmware] triggerFilamentLoad failed: ${err.message}`);
    return false;
  }
}

/**
 * Set LED color/mode on a buddy printer's side strip and/or Dwarf tool-head LEDs.
 * @param {object} connectionDetails
 * @param {number} r,g,b  - 0-255
 * @param {string} mode   - "solid"|"blink"|"pulse"|"pulse_w"|"restore"
 * @param {string} zone   - "all"|"side"|"dwarfs"
 */
export async function setLeds(connectionDetails, r, g, b, mode = 'solid', zone = 'all') {
  try {
    const url = `${connectionDetails.base_url}/api/v1/leds`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: buildHeaders(connectionDetails),
      body: JSON.stringify({ r, g, b, mode, zone }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch (err) {
    logger.warn(`[spoolSyncFirmware] setLeds failed: ${err.message}`);
    return false;
  }
}

/**
 * Push a spool's filament type to a specific tool slot on the firmware.
 * @param {object} connectionDetails
 * @param {number} toolIndex - 0-based tool/slot index
 * @param {object|null} filamentType - FilamentType record (with .material and .colorHex), or null to unload
 */
export async function pushFilamentToFirmware(connectionDetails, toolIndex, filamentType) {
  try {
    const url = `${connectionDetails.base_url}/api/v1/filament`;
    // Use temperature data when available: firmware creates a user filament profile
    // from (material name + temps) when the name doesn't match a built-in preset.
    // Fallback when no temp data: try to find a matching preset name via substring
    // so the firmware's from_name() can still set a valid filament type and M1600
    // won't show the material-selection dialog on the LCD.
    const nozzleTemp = filamentType?.nozzleTempMax ?? filamentType?.nozzleTempMin;
    const bedTemp = filamentType?.bedTempMax ?? filamentType?.bedTempMin;
    const rawMaterial = filamentType?.material ?? '';
    const materialName = nozzleTemp ? rawMaterial : (findPresetMatch(rawMaterial) || rawMaterial);

    const body = {
      tool: toolIndex,
      material: materialName,
      color: filamentType?.colorHex ?? '',
    };
    if (nozzleTemp) body.nozzle_temp = nozzleTemp;
    if (bedTemp) body.bed_temp = bedTemp;
    if (filamentType?.nozzleTempMin) body.preheat_temp = filamentType.nozzleTempMin;

    const res = await fetch(url, {
      method: 'PUT',
      headers: buildHeaders(connectionDetails),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.info(`[spoolSyncFirmware] filament pushed tool=${toolIndex} material=${body.material} to ${connectionDetails.base_url}`);
  } catch (err) {
    logger.warn(`[spoolSyncFirmware] pushFilamentToFirmware failed: ${err.message}`);
  }
}
