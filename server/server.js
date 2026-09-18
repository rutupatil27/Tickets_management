import http from 'node:http';
import { createApp } from './src/app.js';
import { assertEnv, env } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { createSocketServer } from './src/sockets/socketServer.js';
import { logger } from './src/utils/logger.js';

async function bootstrap() {
  assertEnv();

  await connectDB();

  const app = createApp();
  const httpServer = http.createServer(app);

  createSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`SupportDesk API listening on http://localhost:${env.PORT}`);
    logger.info(`Allowed client origins: ${env.CLIENT_URLS.join(', ')}`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down...`);
    httpServer.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start server:\n', error.message);
  process.exit(1);
});
