import type {
  changePasswordSchema,
  deleteAccountSchema,
  updateIdentitySchema,
  updateProfileSchema,
  updateSettingsSchema,
} from '@devpulse/shared';
import type { z } from 'zod';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { sendMail } from '../../utils/mailer';
import { hashPassword, verifyPassword } from '../../utils/password';
import { toUserDto } from './user.mapper';
import { usersRepository } from './users.repository';

async function requireUser(userId: string) {
  const user = await usersRepository.findById(userId);
  if (!user) throw notFound('User');
  return user;
}

async function requirePassword(passwordHash: string, password: string, field: string) {
  if (!(await verifyPassword(passwordHash, password))) {
    throw badRequest('The password you entered is incorrect', [
      { path: field, message: 'Incorrect password' },
    ]);
  }
}

export const usersService = {
  async getMe(userId: string) {
    return toUserDto(await requireUser(userId));
  },

  async updateProfile(userId: string, input: z.output<typeof updateProfileSchema>) {
    return toUserDto(await usersRepository.update(userId, input));
  },

  async updateIdentity(userId: string, input: z.output<typeof updateIdentitySchema>) {
    const user = await requireUser(userId);
    await requirePassword(user.passwordHash, input.currentPassword, 'currentPassword');

    const email = input.email && input.email !== user.email ? input.email : undefined;
    const username =
      input.username && input.username !== user.username ? input.username : undefined;
    if (!email && !username) return toUserDto(user);

    const conflicts = await usersRepository.findConflicts(userId, email, username);
    const details = [];
    if (email && conflicts.some((other) => other.email === email)) {
      details.push({ path: 'email', message: 'An account with this email already exists' });
    }
    if (username && conflicts.some((other) => other.username === username)) {
      details.push({ path: 'username', message: 'This username is already taken' });
    }
    if (details.length > 0) throw conflict('These details are already in use', details);

    const updated = await usersRepository.update(userId, {
      ...(email ? { email } : {}),
      ...(username ? { username } : {}),
    });

    if (email) {
      // Alert the previous address so an unexpected change can be noticed.
      await sendMail({
        to: user.email,
        subject: 'Your DevPulse email address was changed',
        text: `Hi ${user.fullName},\n\nThe email address for your DevPulse account was changed to ${email}.\nIf you did not make this change, reset your password immediately.`,
      });
    }
    return toUserDto(updated);
  },

  async updateSettings(userId: string, input: z.output<typeof updateSettingsSchema>) {
    return toUserDto(await usersRepository.upsertSettings(userId, input));
  },

  async changePassword(
    userId: string,
    sessionId: string,
    input: z.output<typeof changePasswordSchema>,
  ) {
    const user = await requireUser(userId);
    await requirePassword(user.passwordHash, input.currentPassword, 'currentPassword');
    await usersRepository.changePassword(userId, await hashPassword(input.newPassword), sessionId);
  },

  async deleteAccount(userId: string, input: z.output<typeof deleteAccountSchema>) {
    const user = await requireUser(userId);
    await requirePassword(user.passwordHash, input.password, 'password');
    await usersRepository.delete(userId);
  },
};
