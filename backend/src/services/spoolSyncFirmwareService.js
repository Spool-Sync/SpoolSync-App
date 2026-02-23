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
 * Push a spool's filament type to a specific tool slot on the firmware.
 * @param {object} connectionDetails
 * @param {number} toolIndex - 0-based tool/slot index
 * @param {object|null} filamentType - FilamentType record (with .material and .colorHex), or null to unload
 */
export async function pushFilamentToFirmware(connectionDetails, toolIndex, filamentType) {
  try {
    const url = `${connectionDetails.base_url}/api/v1/filament`;
    const body = {
      tool: toolIndex,
      material: filamentType?.material ?? '',
      color: filamentType?.colorHex ?? '',
    };
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
