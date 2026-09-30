import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './database/prisma';
import { startBackgroundJobs } from './jobs';
import { logger } from './utils/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`DevPulse API listening on ${env.API_URL} (port ${env.PORT})`);
});
const stopJobs = startBackgroundJobs();

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);

  stopJobs();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
