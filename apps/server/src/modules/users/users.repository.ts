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
};
