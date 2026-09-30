import { Router } from 'express';
import { searchQuerySchema, type SearchType } from '@devpulse/shared';
import { currentUserId, requireUser } from '../../middleware/authenticate';
import { createRateLimiter } from '../../middleware/rate-limit';
import { valid, validate } from '../../middleware/validate';
import { searchService } from './search.service';

/** Search is typed-as-you-go; this allows fast typing while bounding load. */
const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: (req) => req.auth?.userId ?? req.ip ?? 'unknown',
});

export const searchRouter = Router();

searchRouter.get(
  '/',
  requireUser,
  searchLimiter,
  validate('query', searchQuerySchema),
  async (req, res) => {
    const query = valid<{ q: string; type: SearchType; page: number; pageSize: number }>(
      req,
      'query',
    );
    res.json({ data: await searchService.search(currentUserId(req), query) });
  },
);
