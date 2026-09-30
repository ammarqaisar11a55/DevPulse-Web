import type { RequestHandler } from 'express';
import { currentUserId } from '../../middleware/authenticate';
import { analyticsService } from './analytics.service';

export const analyticsController = {
  overview: (async (req, res) => {
    res.json({ data: await analyticsService.overview(currentUserId(req)) });
  }) satisfies RequestHandler,
};
