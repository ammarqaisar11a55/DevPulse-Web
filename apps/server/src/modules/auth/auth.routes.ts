import { Router } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@devpulse/shared';
import { z } from 'zod';
import { requireUser } from '../../middleware/authenticate';
import { requireTrustedClient } from '../../middleware/csrf';
import { createRateLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import { authController } from './auth.controller';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const credentialLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  // Successful sign-ins do not count, so only guessing is throttled.
  skipSuccessfulRequests: true,
  message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
});

const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 10 });

const resetLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  message: 'Too many password reset requests. Please wait a few minutes and try again.',
});

const refreshLimiter = createRateLimiter({ windowMs: 60 * 1000, limit: 30 });

export const authRouter = Router();

authRouter.post(
  '/register',
  registerLimiter,
  validate('body', registerSchema),
  authController.register,
);
authRouter.post('/login', credentialLimiter, validate('body', loginSchema), authController.login);
authRouter.post('/refresh', refreshLimiter, requireTrustedClient, authController.refresh);
authRouter.post('/logout', requireTrustedClient, authController.logout);
authRouter.post('/logout-all', requireUser, authController.logoutAll);

authRouter.post(
  '/forgot-password',
  resetLimiter,
  validate('body', forgotPasswordSchema),
  authController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  resetLimiter,
  validate('body', resetPasswordSchema),
  authController.resetPassword,
);

authRouter.get('/sessions', requireUser, authController.listSessions);
authRouter.delete(
  '/sessions/:id',
  requireUser,
  validate('params', z.object({ id: z.uuid() })),
  authController.revokeSession,
);
