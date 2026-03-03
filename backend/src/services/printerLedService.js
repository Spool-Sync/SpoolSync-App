/**
 * Printer LED Effect Service
 *
 * Drives animated light effects on prusalink_buddy printers by sending
 * timed color frames to PUT /api/v1/leds on the firmware.
 *
 * Zones:
 *   all    — LCD display strip + case side strip + tool-head LEDs
 *   lcd    — LCD display strip only (M150)
 *   side   — case side strip only (M151)
 *   dwarfs — tool-head LEDs only (Dwarf Modbus)
 *
 * Effects:
 *   solid   — static color (single call)
 *   rainbow — full-spectrum HSV cycle, 150ms/frame
 *   pulse   — firmware-native breathing animation (single call)
 *   police  — alternating red/blue flashes, 350ms/frame
 *   fire    — warm random flicker, 100ms/frame
 *   party   — random bright colors, 180ms/frame
 *   restore — reset to firmware defaults (single call)
 */

import { getById } from './printerService.js';
import { setLeds, isBuddyPrinter } from './spoolSyncFirmwareService.js';
import logger from '../middleware/logger.js';

// `${printerId}:${zone}` → { timer, effect, zone }
// Keyed per-zone so multiple zones on the same printer can run simultaneously.
const activeEffects = new Map();

const EFFECT_INTERVALS = {
  rainbow: 150,
  police:  350,
  fire:    100,
  party:   180,
};

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r, g, b;
  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function stopEffect(printerId, zone = null) {
  if (zone) {
    const key = `${printerId}:${zone}`;
    const entry = activeEffects.get(key);
    if (entry) {
      clearInterval(entry.timer);
      activeEffects.delete(key);
    }
  } else {
    // Stop all zones for this printer
    for (const [key, entry] of activeEffects) {
      if (key.startsWith(`${printerId}:`)) {
        clearInterval(entry.timer);
        activeEffects.delete(key);
      }
    }
  }
}

/**
 * Start or update an LED effect on a printer.
 * @param {string} printerId
 * @param {string} effect  - "solid"|"rainbow"|"pulse"|"police"|"fire"|"party"|"restore"
 * @param {object} color   - { r, g, b }
 * @param {string} zone    - "all"|"lcd"|"side"|"dwarfs"
 */
export async function startEffect(printerId, effect, color = { r: 255, g: 255, b: 255 }, zone = 'all') {
  const printer = await getById(printerId);
  if (!isBuddyPrinter(printer)) {
    throw Object.assign(new Error('LED control requires prusalink_buddy firmware'), { status: 400 });
  }

  const cd = printer.connectionDetails;
  const { r, g, b } = color;

  stopEffect(printerId, zone);

  // Helper: send to the requested zone(s)
  const send = (fr, fg, fb, mode) => setLeds(cd, fr, fg, fb, mode, zone);

  // Single-call effects
  if (effect === 'solid') {
    await send(r, g, b, 'solid');
    return;
  }
  if (effect === 'restore') {
    await send(0, 0, 0, 'restore');
    return;
  }
  if (effect === 'pulse') {
    // Dwarf LEDs have native firmware pulse; side strip and LCD get a dimmed solid
    // because their hardware doesn't support native pulse mode.
    if (zone === 'all' || zone === 'dwarfs') {
      await setLeds(cd, r, g, b, 'pulse', 'dwarfs');
    }
    if (zone === 'all' || zone === 'side') {
      await setLeds(cd, Math.round(r * 0.4), Math.round(g * 0.4), Math.round(b * 0.4), 'solid', 'side');
    }
    if (zone === 'all' || zone === 'lcd') {
      await setLeds(cd, r, g, b, 'pulse', 'lcd');
    }
    return;
  }

  // Animated effects — backend-driven frames
  let frame = 0;
  const intervalMs = EFFECT_INTERVALS[effect] ?? 200;

  const tick = async () => {
    let fr, fg, fb;

    switch (effect) {
      case 'rainbow': {
        const hue = (frame * 4) % 360;
        [fr, fg, fb] = hsvToRgb(hue, 1, 1);
        break;
      }
      case 'police': {
        if (frame % 2 === 0) { fr = 255; fg = 0; fb = 0;   }
        else                  { fr = 0;   fg = 0; fb = 255; }
        break;
      }
      case 'fire': {
        fr = randInt(180, 255);
        fg = randInt(20, 90);
        fb = 0;
        break;
      }
      case 'party': {
        [fr, fg, fb] = hsvToRgb(randInt(0, 359), 1, 1);
        break;
      }
      default:
        stopEffect(printerId);
        return;
    }

    frame++;
    await send(fr, fg, fb, 'solid').catch(() => {});
  };

  await tick();
  const timer = setInterval(tick, intervalMs);
  activeEffects.set(`${printerId}:${zone}`, { timer, effect, zone });

  logger.info(`[printerLedService] started "${effect}" on zone "${zone}" for printer ${printerId}`);
}

export { stopEffect };

export function getActiveEffect(printerId) {
  const result = {};
  for (const [key, entry] of activeEffects) {
    if (key.startsWith(`${printerId}:`)) {
      result[entry.zone] = entry.effect;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}
