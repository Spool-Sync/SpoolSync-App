import { PrismaClient } from '@prisma/client';
import { syncStatus } from './printerService.js';
import logger from '../middleware/logger.js';

const prisma = new PrismaClient();

const POLL_INTERVAL_MS = parseInt(process.env.PRINTER_POLL_INTERVAL_MS ?? '30000', 10);

let intervalHandle = null;

export function startPolling() {
  if (intervalHandle) return;

  logger.info(`[polling] Printer sync every ${POLL_INTERVAL_MS / 1000}s`);

  intervalHandle = setInterval(async () => {
    let printers;
    try {
      printers = await prisma.printer.findMany({ select: { printerId: true, name: true } });
    } catch (err) {
      logger.error(`[polling] Failed to fetch printers: ${err.message}`);
      return;
    }

    for (const printer of printers) {
      try {
        await syncStatus(printer.printerId);
      } catch (err) {
        logger.error(`[polling] Unhandled error syncing ${printer.name}: ${err.message}`);
      }
    }
  }, POLL_INTERVAL_MS);
}

export function stopPolling() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
