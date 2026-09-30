import { Router } from 'express';
import { activityRouter } from './modules/activity/activity.routes';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { projectsRouter } from './modules/projects/projects.routes';
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
  return router;
}
