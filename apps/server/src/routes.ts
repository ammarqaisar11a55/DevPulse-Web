import { Router } from 'express';
import { activityRouter } from './modules/activity/activity.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { authRouter } from './modules/auth/auth.routes';
import { cronRouter } from './modules/cron/cron.routes';
import { devicesRouter } from './modules/devices/devices.routes';
import { goalsRouter } from './modules/goals/goals.routes';
import { healthRouter } from './modules/health/health.routes';
import { extensionActivityRouter } from './modules/integrations/extension.routes';
import { integrationsRouter } from './modules/integrations/integrations.routes';
import { leaderboardRouter } from './modules/leaderboard/leaderboard.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { searchRouter } from './modules/search/search.routes';
import { sessionsRouter } from './modules/sessions/sessions.routes';
import { usersRouter } from './modules/users/users.routes';

/** Mounts every versioned API module. Each module owns its routes, controllers and services. */
export function createApiRouter() {
  const router = Router();
  router.use('/health', healthRouter);
  router.use('/auth', authRouter);
  router.use('/users', usersRouter);
  router.use('/projects', projectsRouter);
  router.use('/sessions', sessionsRouter);
  router.use('/activity', activityRouter);
  router.use('/activity', extensionActivityRouter);
  router.use('/integrations', integrationsRouter);
  router.use('/devices', devicesRouter);
  router.use('/goals', goalsRouter);
  router.use('/notifications', notificationsRouter);
  router.use('/analytics', analyticsRouter);
  router.use('/leaderboard', leaderboardRouter);
  router.use('/search', searchRouter);
  router.use('/internal/cron', cronRouter);
  return router;
}
