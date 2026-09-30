import type { RequestHandler } from 'express';
import { currentAuth, currentUserId } from '../../middleware/authenticate';
import { valid } from '../../middleware/validate';
import { REFRESH_COOKIE, refreshCookieOptions } from '../auth/auth.tokens';
import { usersService } from './users.service';

export const usersController = {
  getMe: (async (req, res) => {
    res.json({ data: await usersService.getMe(currentUserId(req)) });
  }) satisfies RequestHandler,

  updateProfile: (async (req, res) => {
    res.json({ data: await usersService.updateProfile(currentUserId(req), valid(req, 'body')) });
  }) satisfies RequestHandler,

  updateIdentity: (async (req, res) => {
    res.json({ data: await usersService.updateIdentity(currentUserId(req), valid(req, 'body')) });
  }) satisfies RequestHandler,

  updateSettings: (async (req, res) => {
    res.json({ data: await usersService.updateSettings(currentUserId(req), valid(req, 'body')) });
  }) satisfies RequestHandler,

  changePassword: (async (req, res) => {
    const { userId, sessionId } = currentAuth(req);
    await usersService.changePassword(userId, sessionId, valid(req, 'body'));
    res.status(204).end();
  }) satisfies RequestHandler,

  deleteAccount: (async (req, res) => {
    await usersService.deleteAccount(currentUserId(req), valid(req, 'body'));
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    res.status(204).end();
  }) satisfies RequestHandler,
};
