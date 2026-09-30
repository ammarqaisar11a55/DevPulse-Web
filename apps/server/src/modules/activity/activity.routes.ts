import { Router } from 'express';
import { timelineQuerySchema } from '@devpulse/shared';
import { requireUser } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { activityController } from './activity.controller';

/** Read endpoints for the web app. Editor ingestion routes live in the integrations module. */
export const activityRouter = Router();

activityRouter.get(
  '/timeline',
  requireUser,
  validate('query', timelineQuerySchema),
  activityController.timeline,
);
activityRouter.get('/filters', requireUser, activityController.filters);
