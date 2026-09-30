import type { Request, RequestHandler, Response } from 'express';
import { valid } from '../../middleware/validate';
import { currentAuth, currentUserId } from '../../middleware/authenticate';
import { authService, type ClientInfo, type IssuedSession } from './auth.service';
import { REFRESH_COOKIE, refreshCookieOptions } from './auth.tokens';

function clientInfo(req: Request): ClientInfo {
  // Normalise IPv4-mapped IPv6 addresses (::ffff:1.2.3.4) to plain IPv4 for display.
  const ipAddress = req.ip?.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');
  return { userAgent: req.get('user-agent') ?? undefined, ipAddress };
}

function sendSession(res: Response, session: IssuedSession, status = 200) {
  if (session.refreshToken) {
    res.cookie(
      REFRESH_COOKIE,
      session.refreshToken,
      refreshCookieOptions(session.refreshExpiresAt),
    );
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json({ data: session.body });
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export const authController = {
  register: (async (req, res) => {
    sendSession(res, await authService.register(valid(req, 'body'), clientInfo(req)), 201);
  }) satisfies RequestHandler,

  login: (async (req, res) => {
    sendSession(res, await authService.login(valid(req, 'body'), clientInfo(req)));
  }) satisfies RequestHandler,

  refresh: (async (req, res) => {
    try {
      sendSession(res, await authService.refresh(readRefreshCookie(req)));
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
      throw error;
    }
  }) satisfies RequestHandler,

  logout: (async (req, res) => {
    await authService.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    res.status(204).end();
  }) satisfies RequestHandler,

  logoutAll: (async (req, res) => {
    await authService.logoutAll(currentUserId(req));
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    res.status(204).end();
  }) satisfies RequestHandler,

  listSessions: (async (req, res) => {
    const { userId, sessionId } = currentAuth(req);
    const data = await authService.listSessions(userId, sessionId);
    res.json({ data });
  }) satisfies RequestHandler,

  revokeSession: (async (req, res) => {
    const { id } = valid<{ id: string }>(req, 'params');
    await authService.revokeSession(currentUserId(req), id);
    res.status(204).end();
  }) satisfies RequestHandler,

  forgotPassword: (async (req, res) => {
    await authService.requestPasswordReset(valid(req, 'body'));
    res.status(202).json({
      data: { message: 'If an account exists for that email, a reset link is on its way.' },
    });
  }) satisfies RequestHandler,

  resetPassword: (async (req, res) => {
    await authService.resetPassword(valid(req, 'body'));
    res.status(204).end();
  }) satisfies RequestHandler,
};
