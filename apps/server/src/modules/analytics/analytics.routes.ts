import { Router } from 'express';
import { analyticsQuerySchema } from '@devpulse/shared';
import { requireUser } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { analyticsController } from './analytics.controller';

export const analyticsRouter = Router();

analyticsRouter.use(requireUser);
analyticsRouter.get('/overview', analyticsController.overview);
analyticsRouter.get('/report', validate('query', analyticsQuerySchema), analyticsController.report);
analyticsRouter.get(
  '/coding-time',
  validate('query', analyticsQuerySchema),
  analyticsController.codingTime,
);
