import type { RequestHandler } from 'express';
import { prisma } from '../database/prisma';
import { verifyAccessToken } from '../modules/auth/auth.tokens';
import { unauthorized } from '../utils/errors';

function bearerToken(header: string | undefined) {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Requires a valid web access token. The backing session is checked on every request so
 * "log out everywhere" and session revocation take effect immediately rather than when
 * the short-lived JWT expires.
 */
export const requireUser: RequestHandler = async (req, _res, next) => {
  const token = bearerToken(req.get('authorization'));
  const claims = token ? verifyAccessToken(token) : null;
  if (!claims) return next(unauthorized());

  const session = await prisma.authSession.findFirst({
    where: {
      id: claims.sessionId,
      userId: claims.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!session) return next(unauthorized('Your session has ended. Please sign in again.'));

  req.auth = { userId: claims.userId, sessionId: claims.sessionId };
  next();
};

/** Reads the authenticated identity; only call after `requireUser`. */
export function currentAuth(req: Express.Request) {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export function currentUserId(req: Express.Request) {
  return currentAuth(req).userId;
}

export { bearerToken };
