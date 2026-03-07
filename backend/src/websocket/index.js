import { Server } from 'socket.io';
import logger from '../middleware/logger.js';
import * as esp32DeviceService from '../services/esp32DeviceService.js';

let io = null;

export function initWebsocket(httpServer) {
  io = new Server(httpServer, {
    cors: false,
    allowEIO3: true,
  });

  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    socket.onAny((event, ...args) => {
      logger.info(`[ws:any] socket=${socket.id.slice(0, 6)} event=${event} payload=${JSON.stringify(args).slice(0, 300)}`);
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });

    // Forward browser console logs so we can debug mobile clients without DevTools
    socket.on('client:log', ({ level, args }) => {
      const fn = level === 'error' ? logger.error : level === 'warn' ? logger.warn : logger.info;
      fn.call(logger, `[client:${socket.id.slice(0, 6)}] ${args.join(' ')}`);
    });

    // ESP32 firmware reports over WebSocket instead of HTTP POST for lower latency.
    socket.on('esp32:report', async (payload) => {
      try {
        logger.info(`[ws:esp32:report] received from socket=${socket.id.slice(0, 6)} device=${payload?.uniqueDeviceId} channels=${JSON.stringify(payload?.channels)}`);
        await esp32DeviceService.report(payload.uniqueDeviceId, payload);
      } catch (err) {
        logger.error(`[esp32:report] ${err.message}`, { stack: err.stack });
      }
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

export function getIO() {
  return io;
}
