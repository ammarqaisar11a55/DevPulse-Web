import type {
  AuthResponse,
  AuthSessionDto,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@devpulse/shared';
import type { z } from 'zod';
import { env } from '../../config/env';
import { badRequest, conflict, unauthorized } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { sendMail } from '../../utils/mailer';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../utils/password';
import { randomToken, sha256 } from '../../utils/crypto';
import { toUserDto, type UserWithSettings } from '../users/user.mapper';
import { authRepository } from './auth.repository';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_GRACE_MS,
  REFRESH_TOKEN_TTL_MS,
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from './auth.tokens';

export interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
}

/** Result of an operation that starts or renews a browser session. */
export interface IssuedSession {
  body: AuthResponse;
  refreshToken: string | null;
  refreshExpiresAt: Date;
}

type ParsedRegister = z.output<typeof registerSchema>;
type ParsedLogin = z.output<typeof loginSchema>;
type ParsedForgot = z.output<typeof forgotPasswordSchema>;
type ParsedReset = z.output<typeof resetPasswordSchema>;

const INVALID_CREDENTIALS = 'Incorrect email, username or password';

function truncate(value: string | undefined, max: number) {
  return value ? value.slice(0, max) : undefined;
}

async function startSession(user: UserWithSettings, client: ClientInfo): Promise<IssuedSession> {
  const { token, hash } = createRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const session = await authRepository.createSession({
    userId: user.id,
    refreshTokenHash: hash,
    userAgent: truncate(client.userAgent, 400),
    ipAddress: truncate(client.ipAddress, 64),
    expiresAt,
  });
  return {
    body: {
      user: toUserDto(user),
      accessToken: signAccessToken(user.id, session.id),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    },
    refreshToken: token,
    refreshExpiresAt: expiresAt,
  };
}

export const authService = {
  async register(input: ParsedRegister, client: ClientInfo) {
    const conflicts = await authRepository.findConflicts(input.email, input.username);
    const details = [];
    if (conflicts.some((user) => user.email === input.email)) {
      details.push({ path: 'email', message: 'An account with this email already exists' });
    }
    if (conflicts.some((user) => user.username === input.username)) {
      details.push({ path: 'username', message: 'This username is already taken' });
    }
    if (details.length > 0) throw conflict('An account with these details already exists', details);

    const user = await authRepository.createUser({
      email: input.email,
      username: input.username,
      fullName: input.fullName,
      passwordHash: await hashPassword(input.password),
    });
    return startSession(user, client);
  },

  async login(input: ParsedLogin, client: ClientInfo) {
    const user = await authRepository.findUserByIdentifier(input.identifier);
    if (!user) {
      await verifyAgainstDummy(input.password);
      throw unauthorized(INVALID_CREDENTIALS);
    }
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw unauthorized(INVALID_CREDENTIALS);
    }
    await authRepository.recordLogin(user.id);
    return startSession(user, client);
  },

  /**
   * Exchanges a refresh token for a new access token, rotating the refresh token.
   * Presenting a token that was already rotated out (outside the grace window) is treated
   * as theft: the whole session is revoked.
   */
  async refresh(refreshToken: string | undefined): Promise<IssuedSession> {
    if (!refreshToken) throw unauthorized('Your session has expired. Please sign in again.');
    const presentedHash = hashRefreshToken(refreshToken);
    const session = await authRepository.findSessionByTokenHash(presentedHash);

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw unauthorized('Your session has expired. Please sign in again.');
    }

    const user = await authRepository.findUserById(session.userId);
    if (!user) throw unauthorized('Your session has expired. Please sign in again.');

    const isPrevious =
      session.previousTokenHash === presentedHash && session.refreshTokenHash !== presentedHash;
    if (isPrevious) {
      const withinGrace =
        session.rotatedAt && Date.now() - session.rotatedAt.getTime() < REFRESH_GRACE_MS;
      if (!withinGrace) {
        await authRepository.revokeSession(session.id);
        logger.warn(
          { sessionId: session.id, userId: session.userId },
          'Refresh token reuse detected; session revoked',
        );
        throw unauthorized('Your session has expired. Please sign in again.');
      }
      // A concurrent request already rotated the cookie; issue an access token without rotating again.
      await authRepository.touchSession(session.id);
      return {
        body: {
          user: toUserDto(user),
          accessToken: signAccessToken(user.id, session.id),
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
        refreshToken: null,
        refreshExpiresAt: session.expiresAt,
      };
    }

    const next = createRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const rotated = await authRepository.rotateSession(
      session.id,
      presentedHash,
      next.hash,
      expiresAt,
    );
    if (!rotated) {
      // Lost a race with another refresh of the same token: retry via the grace path.
      return authService.refresh(refreshToken);
    }
    return {
      body: {
        user: toUserDto(user),
        accessToken: signAccessToken(user.id, session.id),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
      refreshToken: next.token,
      refreshExpiresAt: expiresAt,
    };
  },

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    const session = await authRepository.findSessionByTokenHash(hashRefreshToken(refreshToken));
    if (session) await authRepository.revokeSession(session.id);
  },

  async logoutAll(userId: string) {
    await authRepository.revokeAllSessions(userId);
  },

  async listSessions(userId: string, currentSessionId: string): Promise<AuthSessionDto[]> {
    const sessions = await authRepository.listActiveSessions(userId);
    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      current: session.id === currentSessionId,
    }));
  },

  async revokeSession(userId: string, sessionId: string) {
    await authRepository.revokeSession(sessionId, userId);
  },

  /** Always resolves the same way so the endpoint cannot be used to discover accounts. */
  async requestPasswordReset(input: ParsedForgot) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) return;

    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000);
    await authRepository.createPasswordResetToken(user.id, sha256(token), expiresAt);

    const link = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your DevPulse password',
      text: [
        `Hi ${user.fullName},`,
        '',
        'Someone asked to reset the password for your DevPulse account.',
        `Use this link within ${env.PASSWORD_RESET_TTL_MINUTES} minutes to choose a new password:`,
        '',
        link,
        '',
        'If you did not ask for this, you can ignore this email. Your password will not change.',
      ].join('\n'),
    });
  },

  async resetPassword(input: ParsedReset) {
    const record = await authRepository.findPasswordResetToken(sha256(input.token));
    const invalid = badRequest('This reset link is invalid or has expired. Request a new one.');
    if (!record || record.usedAt || record.expiresAt <= new Date()) throw invalid;

    const done = await authRepository.completePasswordReset(
      record.id,
      record.userId,
      await hashPassword(input.password),
    );
    if (!done) throw invalid;
  },
};
