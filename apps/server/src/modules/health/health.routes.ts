import { Router } from 'express';
import { prisma } from '../../database/prisma';

export const healthRouter = Router();

/** Liveness: the process is up. */
healthRouter.get('/', (_req, res) => {
  res.json({ data: { status: 'ok', uptime: Math.round(process.uptime()) } });
});

/** Readiness: dependencies (database) are reachable. */
healthRouter.get('/ready', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ data: { status: 'ready' } });
});
