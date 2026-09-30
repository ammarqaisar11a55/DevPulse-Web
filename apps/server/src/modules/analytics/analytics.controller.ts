import type { RequestHandler } from 'express';
import { currentUserId } from '../../middleware/authenticate';
import { valid } from '../../middleware/validate';
import { analyticsService } from './analytics.service';

export const analyticsController = {
  overview: (async (req, res) => {
    res.json({ data: await analyticsService.overview(currentUserId(req)) });
  }) satisfies RequestHandler,

  report: (async (req, res) => {
    res.json({ data: await analyticsService.report(currentUserId(req), valid(req, 'query')) });
  }) satisfies RequestHandler,

  codingTime: (async (req, res) => {
    res.json({ data: await analyticsService.codingTime(currentUserId(req), valid(req, 'query')) });
  }) satisfies RequestHandler,
};
