import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { usersRouter } from './modules/users/users.routes';

/** Mounts every versioned API module. Each module owns its routes, controllers and services. */
export function createApiRouter() {
  const router = Router();
  router.use('/health', healthRouter);
  router.use('/auth', authRouter);
  router.use('/users', usersRouter);
  return router;
}
