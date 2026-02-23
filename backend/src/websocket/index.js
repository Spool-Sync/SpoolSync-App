import { Server } from 'socket.io';
import logger from '../middleware/logger.js';

let io = null;

export function initWebsocket(httpServer) {
  io = new Server(httpServer, {
    cors: false,
  });

  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });

    // Forward browser console logs so we can debug mobile clients without DevTools
    socket.on('client:log', ({ level, args }) => {
      const fn = level === 'error' ? logger.error : level === 'warn' ? logger.warn : logger.info;
      fn.call(logger, `[client:${socket.id.slice(0, 6)}] ${args.join(' ')}`);
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

export function getIO() {
  return io;
}
