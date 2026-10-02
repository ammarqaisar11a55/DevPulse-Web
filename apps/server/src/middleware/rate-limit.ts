import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { isTest } from '../config/env';
import { rateLimited } from '../utils/errors';

/**
 * In-memory rate limiter. For multi-instance deployments, plug a shared store
 * (e.g. rate-limit-redis) into `store` without changing call sites.
 */
export function createRateLimiter(options: Partial<Options> & { message?: string }) {
  const { message, ...rest } = options;
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => isTest && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== 'true',
    handler: (_req, _res, next) => next(rateLimited(message)),
    ...rest,
  });
}

export const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 300,
});

/**
 * Keys a limiter by an authenticated principal (user or device id), falling back to the client
 * address. IPv6 addresses are grouped by subnet so one client cannot rotate through its range.
 */
export function principalKey(principal: (req: Request) => string | undefined) {
  return (req: Request) => principal(req) ?? (req.ip ? ipKeyGenerator(req.ip) : 'unknown');
}
