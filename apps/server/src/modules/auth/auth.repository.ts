import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

const withSettings = { settings: true } satisfies Prisma.UserInclude;

export const authRepository = {
  findUserById(id: string) {
    return prisma.user.findUnique({ where: { id }, include: withSettings });
  },

  findUserByIdentifier(identifier: string) {
    const normalized = identifier.trim().toLowerCase();
    const where = normalized.includes('@') ? { email: normalized } : { username: normalized };
    return prisma.user.findUnique({ where, include: withSettings });
  },

  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findConflicts(email: string, username: string) {
    return prisma.user.findMany({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
  },

  createUser(data: {
    email: string;
    username: string;
    fullName: string;
    passwordHash: string;
    timezone?: string;
  }) {
    return prisma.user.create({
      data: { ...data, settings: { create: {} } },
      include: withSettings,
    });
  },

  createSession(data: {
    userId: string;
    refreshTokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }) {
    return prisma.authSession.create({ data });
  },

  findSessionByTokenHash(hash: string) {
    return prisma.authSession.findFirst({
      where: { OR: [{ refreshTokenHash: hash }, { previousTokenHash: hash }] },
    });
  },

  findActiveSession(id: string, userId: string) {
    return prisma.authSession.findFirst({
      where: { id, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
  },

  /**
   * Rotates atomically: only succeeds if the presented hash is still current, so two
   * concurrent refreshes cannot both rotate the same token.
   */
  async rotateSession(id: string, currentHash: string, nextHash: string, expiresAt: Date) {
    const result = await prisma.authSession.updateMany({
      where: { id, refreshTokenHash: currentHash, revokedAt: null },
      data: {
        refreshTokenHash: nextHash,
        previousTokenHash: currentHash,
        rotatedAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt,
      },
    });
    return result.count === 1;
  },

  touchSession(id: string) {
    return prisma.authSession.update({ where: { id }, data: { lastUsedAt: new Date() } });
  },

  revokeSession(id: string, userId?: string) {
    return prisma.authSession.updateMany({
      where: { id, ...(userId ? { userId } : {}), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllSessions(userId: string, exceptSessionId?: string) {
    return prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  },

  listActiveSessions(userId: string) {
    return prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  },

  recordLogin(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  },

  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  },

  findPasswordResetToken(tokenHash: string) {
    return prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  },

  /**
   * Consumes a reset token and sets the new password in one transaction. Every other
   * outstanding reset token and every signed-in session for the user is invalidated.
   */
  async completePasswordReset(tokenId: string, userId: string, passwordHash: string) {
    return prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: tokenId, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) return false;

      const now = new Date();
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: now },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });
  },
};
