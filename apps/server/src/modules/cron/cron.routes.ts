import { Router, type RequestHandler } from 'express';
import { env } from '../../config/env';
import { safeEqual } from '../../utils/crypto';
import { notFound, unauthorized } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { sessionsService } from '../sessions/sessions.service';

/**
 * Scheduled jobs for serverless hosts, where no process stays up to run timers. A scheduler
 * (Vercel Cron) calls these with `Authorization: Bearer <CRON_SECRET>`. Long-running servers use
 * the in-process timers in jobs/ instead.
 */
const requireCronSecret: RequestHandler = (req, _res, next) => {
  if (!env.CRON_SECRET) return next(notFound());
  const header = req.get('authorization') ?? '';
  if (!safeEqual(header, `Bearer ${env.CRON_SECRET}`)) return next(unauthorized());
  next();
};

export const cronRouter = Router();

cronRouter.use(requireCronSecret);
cronRouter.get('/close-stale-sessions', async (_req, res) => {
  const closed = await sessionsService.closeStaleSessions();
  if (closed > 0) logger.info({ count: closed }, 'Closed stale coding sessions');
  res.json({ data: { closed } });
});
