import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { API_PREFIX } from '@devpulse/shared';
import { env } from '../../config/env';
import { hmacSha256, randomToken } from '../../utils/crypto';

const ISSUER = 'devpulse';
const AUDIENCE = 'devpulse-web';

export const REFRESH_COOKIE = 'dp_refresh';
export const ACCESS_TOKEN_TTL_SECONDS = env.ACCESS_TOKEN_TTL_MINUTES * 60;
export const REFRESH_TOKEN_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
/** Window in which a just-rotated refresh token is still honoured (concurrent tabs). */
export const REFRESH_GRACE_MS = 30_000;

interface AccessTokenClaims {
  sub: string;
  sid: string;
  typ: 'access';
}

export function signAccessToken(userId: string, sessionId: string) {
  const claims: AccessTokenClaims = { sub: userId, sid: sessionId, typ: 'access' };
  return jwt.sign(claims, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

/** Returns the claims, or null for any invalid, expired or foreign token. */
export function verifyAccessToken(token: string): { userId: string; sessionId: string } | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (
      typeof payload !== 'object' ||
      payload.typ !== 'access' ||
      !payload.sub ||
      typeof payload.sid !== 'string'
    ) {
      return null;
    }
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

export function createRefreshToken() {
  const token = randomToken(32);
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string) {
  return hmacSha256(token, env.REFRESH_SECRET);
}

export function refreshCookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    // Scoped to auth endpoints so the cookie is not sent with every API call.
    path: `${API_PREFIX}/auth`,
    ...(expires ? { expires } : {}),
  };
}
