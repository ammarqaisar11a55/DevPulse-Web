import { Router } from 'express';
import {
  changePasswordSchema,
  deleteAccountSchema,
  updateIdentitySchema,
  updateProfileSchema,
  updateSettingsSchema,
} from '@devpulse/shared';
import { requireUser } from '../../middleware/authenticate';
import { createRateLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import { usersController } from './users.controller';

/** Endpoints that verify the current password are throttled against guessing. */
const passwordCheckLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 10 });

export const usersRouter = Router();

usersRouter.use(requireUser);
usersRouter.get('/me', usersController.getMe);
usersRouter.patch('/me', validate('body', updateProfileSchema), usersController.updateProfile);
usersRouter.patch(
  '/me/identity',
  passwordCheckLimiter,
  validate('body', updateIdentitySchema),
  usersController.updateIdentity,
);
usersRouter.patch(
  '/me/settings',
  validate('body', updateSettingsSchema),
  usersController.updateSettings,
);
usersRouter.post(
  '/me/password',
  passwordCheckLimiter,
  validate('body', changePasswordSchema),
  usersController.changePassword,
);
usersRouter.delete(
  '/me',
  passwordCheckLimiter,
  validate('body', deleteAccountSchema),
  usersController.deleteAccount,
);
