import { Router } from 'express';
import { leaderboardQuerySchema, type LeaderboardQuery } from '@devpulse/shared';
import { currentUserId, requireUser } from '../../middleware/authenticate';
import { validate, valid } from '../../middleware/validate';
import { leaderboardService } from './leaderboard.service';

export const leaderboardRouter = Router();

leaderboardRouter.get(
  '/',
  requireUser,
  validate('query', leaderboardQuerySchema),
  async (req, res) => {
    const query = valid<Required<LeaderboardQuery>>(req, 'query');
    res.json({ data: await leaderboardService.get(currentUserId(req), query.period, query.limit) });
  },
);
