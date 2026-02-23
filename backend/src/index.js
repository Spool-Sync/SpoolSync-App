import { createServer } from 'http';
import app from './app.js';
import { initWebsocket } from './websocket/index.js';
import { startPolling } from './services/pollingService.js';
import logger from './middleware/logger.js';

const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);
initWebsocket(httpServer);
startPolling();

httpServer.listen(PORT, () => {
  logger.info(`SpoolSync backend running on port ${PORT} (${process.env.NODE_ENV})`);
});
