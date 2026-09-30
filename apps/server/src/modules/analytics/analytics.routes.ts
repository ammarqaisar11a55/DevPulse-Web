import { Router } from 'express';
import { requireUser } from '../../middleware/authenticate';
import { analyticsController } from './analytics.controller';

export const analyticsRouter = Router();

analyticsRouter.use(requireUser);
analyticsRouter.get('/overview', analyticsController.overview);
