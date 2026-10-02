import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

export const usersRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, include: { settings: true } });
  },

  findConflicts(userId: string, email?: string, username?: string) {
    const or: Prisma.UserWhereInput[] = [];
    if (email) or.push({ email });
    if (username) or.push({ username });
    return prisma.user.findMany({
      where: { OR: or, id: { not: userId } },
      select: { email: true, username: true },
    });
  },

  update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data, include: { settings: true } });
  },

  async upsertSettings(userId: string, data: Prisma.UserSettingCreateWithoutUserInput) {
    await prisma.userSetting.upsert({
      where: { userId },
      update: data,
      create: { ...data, userId },
    });
    return prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { settings: true } });
  },

  async changePassword(userId: string, passwordHash: string, keepSessionId: string) {
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: now } }),
      prisma.authSession.updateMany({
        where: { userId, revokedAt: null, id: { not: keepSessionId } },
        data: { revokedAt: now },
      }),
    ]);
  },

  delete(id: string) {
    return prisma.user.delete({ where: { id } });
  },

  /** Starts an email change, replacing any earlier request that was never confirmed. */
  async createEmailChange(userId: string, newEmail: string, tokenHash: string, expiresAt: Date) {
    await prisma.$transaction([
      prisma.emailChangeRequest.deleteMany({ where: { userId, usedAt: null } }),
      prisma.emailChangeRequest.create({ data: { userId, newEmail, tokenHash, expiresAt } }),
    ]);
  },

  findPendingEmailChange(userId: string, now = new Date()) {
    return prisma.emailChangeRequest.findFirst({
      where: { userId, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
  },

  cancelEmailChanges(userId: string) {
    return prisma.emailChangeRequest.deleteMany({ where: { userId, usedAt: null } });
  },

  findEmailChangeByToken(tokenHash: string) {
    return prisma.emailChangeRequest.findUnique({ where: { tokenHash } });
  },

  /**
   * Consumes the request and switches the address in one transaction. Returns null when the
   * request was already used or has expired. A clash with another account's email (unique
   * constraint) rolls the whole change back, leaving the request unused.
   */
  async completeEmailChange(requestId: string, userId: string, newEmail: string) {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const consumed = await tx.emailChangeRequest.updateMany({
        where: { id: requestId, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count === 0) return null;
      const previous = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, fullName: true },
      });
      await tx.user.update({ where: { id: userId }, data: { email: newEmail } });
      await tx.emailChangeRequest.deleteMany({ where: { userId, usedAt: null } });
      return previous;
    });
  },
};
