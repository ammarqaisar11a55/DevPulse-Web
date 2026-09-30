import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { forbidden } from '../utils/errors';

const trustedOrigins = new Set([new URL(env.FRONTEND_URL).origin, new URL(env.API_URL).origin]);

/**
 * CSRF defence for endpoints authenticated by the refresh cookie. The cookie is already
 * SameSite=Strict; in addition, the request must carry the custom client header (which
 * cross-site forms cannot set without a CORS preflight) and, when present, a trusted Origin.
 */
export const requireTrustedClient: RequestHandler = (req, _res, next) => {
  if (!req.get('x-devpulse-client')) {
    return next(forbidden('Missing client header'));
  }
  const origin = req.get('origin');
  if (origin && !trustedOrigins.has(origin)) {
    return next(forbidden('Untrusted request origin'));
  }
  next();
};
