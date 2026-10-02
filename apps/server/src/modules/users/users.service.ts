import {
  EMAIL_CHANGE_TTL_HOURS,
  type PendingEmailChangeDto,
  type changePasswordSchema,
  type confirmEmailChangeSchema,
  type deleteAccountSchema,
  type updateIdentitySchema,
  type updateProfileSchema,
  type updateSettingsSchema,
} from '@devpulse/shared';
import type { z } from 'zod';
import { env } from '../../config/env';
import { randomToken, sha256 } from '../../utils/crypto';
import { emitDomainEvent } from '../../utils/domain-events';
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

async function requestEmailChange(user: { id: string; fullName: string }, newEmail: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_HOURS * 3_600_000);
  await usersRepository.createEmailChange(user.id, newEmail, sha256(token), expiresAt);

  const link = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: newEmail,
    subject: 'Confirm your new DevPulse email address',
    text: [
      `Hi ${user.fullName},`,
      '',
      'You asked to use this address to sign in to DevPulse.',
      `Open this link within ${EMAIL_CHANGE_TTL_HOURS} hours to confirm the change:`,
      '',
      link,
      '',
      'Until then you keep signing in with your current address. If you did not ask for this,',
      'you can ignore this email.',
    ].join('\n'),
  });
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

  /**
   * Changes the username immediately. A new email is only stored as pending: a link is sent to
   * that address, and sign-in moves to it once the link is opened (see confirmEmailChange).
   */
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

    const updated = username ? await usersRepository.update(userId, { username }) : user;
    if (email) await requestEmailChange(user, email);
    return toUserDto(updated);
  },

  async getPendingEmailChange(userId: string): Promise<PendingEmailChangeDto | null> {
    const pending = await usersRepository.findPendingEmailChange(userId);
    return pending
      ? { newEmail: pending.newEmail, expiresAt: pending.expiresAt.toISOString() }
      : null;
  },

  async cancelEmailChange(userId: string) {
    await usersRepository.cancelEmailChanges(userId);
  },

  /** Called from the emailed link; the token alone proves control of the new address. */
  async confirmEmailChange(input: z.output<typeof confirmEmailChangeSchema>) {
    const invalid = badRequest(
      'This confirmation link is invalid or has expired. Request the change again from your settings.',
    );
    const request = await usersRepository.findEmailChangeByToken(sha256(input.token));
    if (!request || request.usedAt || request.expiresAt <= new Date()) throw invalid;

    const taken = await usersRepository.findConflicts(request.userId, request.newEmail);
    if (taken.length > 0) {
      throw conflict('Another account started using this email address in the meantime');
    }

    const previous = await usersRepository.completeEmailChange(
      request.id,
      request.userId,
      request.newEmail,
    );
    if (!previous) throw invalid;

    // Tell the old address, so a change the owner did not expect can be noticed.
    await sendMail({
      to: previous.email,
      subject: 'Your DevPulse email address was changed',
      text: [
        `Hi ${previous.fullName},`,
        '',
        `The email address for your DevPulse account was changed to ${request.newEmail}.`,
        'If you did not make this change, reset your password immediately.',
      ].join('\n'),
    });
    await emitDomainEvent('security.email_changed', {
      userId: request.userId,
      newEmail: request.newEmail,
    });
    return { email: request.newEmail };
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
    await emitDomainEvent('security.password_changed', { userId });
  },

  async deleteAccount(userId: string, input: z.output<typeof deleteAccountSchema>) {
    const user = await requireUser(userId);
    await requirePassword(user.passwordHash, input.password, 'password');
    await usersRepository.delete(userId);
  },
};
