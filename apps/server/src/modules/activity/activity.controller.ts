import type { RequestHandler } from 'express';
import { currentUserId } from '../../middleware/authenticate';
import { valid } from '../../middleware/validate';
import { activityService } from './activity.service';

export const activityController = {
  timeline: (async (req, res) => {
    res.json(await activityService.timeline(currentUserId(req), valid(req, 'query')));
  }) satisfies RequestHandler,

  filters: (async (req, res) => {
    res.json({ data: await activityService.filterOptions(currentUserId(req)) });
  }) satisfies RequestHandler,
};
