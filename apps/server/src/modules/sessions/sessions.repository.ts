import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { activityFiltersSchema } from '@devpulse/shared';
import { prisma } from '../../database/prisma';
import { sessionInclude } from './session.mapper';

export type ActivityFilters = z.output<typeof activityFiltersSchema>;

/** Prisma filter for a user's sessions matching the shared activity filters. */
export function sessionWhere(
  userId: string,
  filters: ActivityFilters,
): Prisma.CodingSessionWhereInput {
  return {
    userId,
    ...(filters.from || filters.to
      ? {
          startedAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lt: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.projectId === 'none'
      ? { projectId: null }
      : filters.projectId
        ? { projectId: filters.projectId }
        : {}),
    ...(filters.deviceId ? { deviceId: filters.deviceId } : {}),
    ...(filters.language ? { languages: { some: { language: filters.language } } } : {}),
    ...(filters.repository ? { repository: filters.repository } : {}),
  };
}

export const sessionsRepository = {
  findOwned(userId: string, id: string) {
    return prisma.codingSession.findFirst({ where: { id, userId }, include: sessionInclude });
  },

  findByClientId(deviceId: string, clientSessionId: string) {
    return prisma.codingSession.findUnique({
      where: { deviceId_clientSessionId: { deviceId, clientSessionId } },
      include: sessionInclude,
    });
  },

  list(
    where: Prisma.CodingSessionWhereInput,
    orderBy: Prisma.CodingSessionOrderByWithRelationInput[],
    skip: number,
    take: number,
  ) {
    return Promise.all([
      prisma.codingSession.count({ where }),
      prisma.codingSession.findMany({ where, orderBy, skip, take, include: sessionInclude }),
    ]);
  },

  findPage(
    where: Prisma.CodingSessionWhereInput,
    orderBy: Prisma.CodingSessionOrderByWithRelationInput[],
    take: number,
  ) {
    return prisma.codingSession.findMany({ where, orderBy, take, include: sessionInclude });
  },

  languages(sessionId: string) {
    return prisma.sessionLanguage.findMany({
      where: { sessionId },
      orderBy: { activeSeconds: 'desc' },
      select: { language: true, activeSeconds: true },
    });
  },

  eventCounts(sessionId: string) {
    return prisma.activityEvent.groupBy({
      by: ['type'],
      where: { sessionId },
      _count: { _all: true },
    });
  },

  /** Creates a session with its language breakdown and bumps the project's last activity. */
  async create(
    data: Prisma.CodingSessionUncheckedCreateInput,
    languages: { language: string; activeSeconds: number }[],
  ) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.codingSession.create({
        data: { ...data, languages: { create: languages } },
        include: sessionInclude,
      });
      if (session.projectId)
        await touchProject(
          tx,
          session.projectId,
          session.endedAt ?? session.lastHeartbeatAt ?? session.startedAt,
        );
      return session;
    });
  },

  async update(
    id: string,
    data: Prisma.CodingSessionUncheckedUpdateInput,
    languages?: { language: string; activeSeconds: number }[],
  ) {
    return prisma.$transaction(async (tx) => {
      if (languages) {
        await tx.sessionLanguage.deleteMany({ where: { sessionId: id } });
        await tx.sessionLanguage.createMany({
          data: languages.map((entry) => ({ ...entry, sessionId: id })),
        });
      }
      const session = await tx.codingSession.update({
        where: { id },
        data,
        include: sessionInclude,
      });
      if (session.projectId)
        await touchProject(
          tx,
          session.projectId,
          session.endedAt ?? session.lastHeartbeatAt ?? session.startedAt,
        );
      return session;
    });
  },

  delete(id: string) {
    return prisma.codingSession.delete({ where: { id } });
  },

  /** Ends sessions left ACTIVE (e.g. editor crashed) at their last heartbeat. */
  async closeStale(where: Prisma.CodingSessionWhereInput) {
    const stale = await prisma.codingSession.findMany({
      where: { ...where, status: 'ACTIVE' },
      select: { id: true, startedAt: true, lastHeartbeatAt: true, activeSeconds: true },
    });
    const closed = [];
    for (const session of stale) {
      const endedAt = session.lastHeartbeatAt ?? session.startedAt;
      const durationSeconds = Math.max(
        0,
        Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000),
      );
      const activeSeconds = Math.min(session.activeSeconds, durationSeconds);
      closed.push(
        await prisma.codingSession.update({
          where: { id: session.id },
          data: {
            status: 'ENDED',
            endedAt,
            durationSeconds,
            activeSeconds,
            idleSeconds: durationSeconds - activeSeconds,
          },
        }),
      );
    }
    return closed;
  },
};

async function touchProject(tx: Prisma.TransactionClient, projectId: string, at: Date) {
  await tx.project.updateMany({
    where: { id: projectId, OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: at } }] },
    data: { lastActivityAt: at },
  });
}
