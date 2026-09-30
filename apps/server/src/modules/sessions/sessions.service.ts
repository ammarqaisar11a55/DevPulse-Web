import type {
  CodingSessionDetailDto,
  createSessionSchema,
  listSessionsQuerySchema,
  projectRefSchema,
  updateSessionSchema,
} from '@devpulse/shared';
import type { CodingSession, Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../database/prisma';
import { emitDomainEvent } from '../../utils/domain-events';
import { conflict, notFound } from '../../utils/errors';
import { pageMeta, skipTake } from '../../utils/pagination';
import { projectsService } from '../projects/projects.service';
import { assertNotInFuture, computeTiming, normaliseLanguages } from './session-math';
import { toSessionDto } from './session.mapper';
import { sessionWhere, sessionsRepository } from './sessions.repository';

/**
 * Who is writing session data. Web users log MANUAL sessions; paired editors write EXTENSION
 * sessions and may only touch sessions recorded by the same device.
 */
export interface SessionActor {
  userId: string;
  deviceId?: string;
}

type CreateInput = z.output<typeof createSessionSchema>;
type UpdateInput = z.output<typeof updateSessionSchema>;
type ListQuery = z.output<typeof listSessionsQuerySchema>;

/** A session left ACTIVE without a heartbeat for this long is closed automatically. */
export const STALE_SESSION_MS = 30 * 60 * 1000;

const ORDER: Record<ListQuery['sort'], Prisma.CodingSessionOrderByWithRelationInput[]> = {
  recent: [{ startedAt: 'desc' }, { id: 'desc' }],
  oldest: [{ startedAt: 'asc' }, { id: 'asc' }],
  longest: [{ activeSeconds: 'desc' }, { id: 'desc' }],
};

async function resolveProjectId(
  userId: string,
  projectId: string | null | undefined,
  ref: z.output<typeof projectRefSchema> | undefined,
) {
  if (projectId) {
    const owned = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });
    if (!owned) throw notFound('Project');
    return owned.id;
  }
  if (!ref) return projectId === null ? null : undefined;

  // Match the workspace to an existing project by repository URL, then by name.
  const existing =
    (ref.repositoryUrl &&
      (await prisma.project.findFirst({
        where: { userId, repositoryUrl: ref.repositoryUrl },
        select: { id: true },
      }))) ||
    (await prisma.project.findFirst({
      where: { userId, name: { equals: ref.name, mode: 'insensitive' } },
      select: { id: true },
    }));
  if (existing) return existing.id;
  const created = await projectsService.create(userId, {
    name: ref.name,
    repositoryUrl: ref.repositoryUrl ?? null,
  });
  return created.id;
}

async function requireSession(actor: SessionActor, id: string) {
  const session = await sessionsRepository.findOwned(actor.userId, id);
  // Devices only see their own sessions; anything else is reported as missing.
  if (!session || (actor.deviceId && session.deviceId !== actor.deviceId))
    throw notFound('Session');
  return session;
}

async function announceRecorded(session: CodingSession) {
  if (session.status !== 'ENDED' || !session.endedAt) return;
  await emitDomainEvent('session.recorded', {
    userId: session.userId,
    sessionId: session.id,
    projectId: session.projectId,
    activeSeconds: session.activeSeconds,
    endedAt: session.endedAt,
  });
}

export const sessionsService = {
  async create(actor: SessionActor, input: CreateInput) {
    if (actor.deviceId && input.clientSessionId) {
      const existing = await sessionsRepository.findByClientId(
        actor.deviceId,
        input.clientSessionId,
      );
      if (existing) return { session: toSessionDto(existing), created: false };
    }

    assertNotInFuture(input.startedAt, 'startedAt');
    if (input.endedAt) assertNotInFuture(input.endedAt, 'endedAt');

    const ended = Boolean(input.endedAt);
    const effectiveEnd = input.endedAt ?? input.startedAt;
    const timing = computeTiming(
      input.startedAt,
      effectiveEnd,
      input.activeSeconds ?? (ended ? Number.MAX_SAFE_INTEGER : 0),
    );
    const languages = normaliseLanguages(input.languages, input.language, timing.activeSeconds);
    const projectId = await resolveProjectId(actor.userId, input.projectId, input.project);

    if (actor.deviceId) {
      // A new session from a device supersedes any session it left open.
      const closed = await sessionsRepository.closeStale({
        userId: actor.userId,
        deviceId: actor.deviceId,
      });
      await Promise.all(closed.map(announceRecorded));
    }

    const session = await sessionsRepository.create(
      {
        userId: actor.userId,
        deviceId: actor.deviceId ?? null,
        clientSessionId: actor.deviceId ? (input.clientSessionId ?? null) : null,
        projectId: projectId ?? null,
        source: actor.deviceId ? 'EXTENSION' : 'MANUAL',
        status: ended ? 'ENDED' : 'ACTIVE',
        title: input.title ?? null,
        startedAt: input.startedAt,
        endedAt: input.endedAt ?? null,
        lastHeartbeatAt: effectiveEnd,
        ...timing,
        language: input.language ?? languages[0]?.language ?? null,
        repository: input.repository ?? null,
        branch: input.branch ?? null,
        editor: input.editor ?? (actor.deviceId ? 'vscode' : null),
        filesChanged: input.filesChanged ?? 0,
        linesAdded: input.linesAdded ?? 0,
        linesRemoved: input.linesRemoved ?? 0,
        commits: input.commits ?? 0,
      },
      languages,
    );
    await announceRecorded(session);
    return { session: toSessionDto(session), created: true };
  },

  /** Applies a heartbeat, completion or metadata change. */
  async update(actor: SessionActor, id: string, input: UpdateInput) {
    const session = await requireSession(actor, id);
    const changesTiming =
      input.lastHeartbeatAt !== undefined ||
      input.endedAt !== undefined ||
      input.activeSeconds !== undefined;
    if (changesTiming && session.status === 'ENDED') {
      // Idempotent retry of the same completion is accepted.
      const sameEnd =
        input.endedAt && session.endedAt && input.endedAt.getTime() === session.endedAt.getTime();
      if (!sameEnd) throw conflict('This session has already ended');
      return toSessionDto(session);
    }

    const data: Prisma.CodingSessionUncheckedUpdateInput = {};
    let languages: { language: string; activeSeconds: number }[] | undefined;

    if (changesTiming) {
      const end =
        input.endedAt ?? input.lastHeartbeatAt ?? session.lastHeartbeatAt ?? session.startedAt;
      assertNotInFuture(end, input.endedAt ? 'endedAt' : 'lastHeartbeatAt');
      const timing = computeTiming(
        session.startedAt,
        end,
        input.activeSeconds ?? session.activeSeconds,
      );
      Object.assign(data, timing, { lastHeartbeatAt: end });
      if (input.endedAt) Object.assign(data, { endedAt: input.endedAt, status: 'ENDED' });
      if (input.languages)
        languages = normaliseLanguages(
          input.languages,
          input.language ?? session.language,
          timing.activeSeconds,
        );
    } else if (input.languages) {
      languages = normaliseLanguages(
        input.languages,
        input.language ?? session.language,
        session.activeSeconds,
      );
    }

    if (input.projectId !== undefined)
      data.projectId = await resolveProjectId(actor.userId, input.projectId, undefined);
    for (const key of ['title', 'language', 'repository', 'branch', 'editor'] as const) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    for (const key of ['filesChanged', 'linesAdded', 'linesRemoved', 'commits'] as const) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    if (languages && input.language === undefined && languages[0])
      data.language = languages[0].language;

    const updated = await sessionsRepository.update(id, data, languages);
    if (session.status === 'ACTIVE' && updated.status === 'ENDED') await announceRecorded(updated);
    return toSessionDto(updated);
  },

  async get(actor: SessionActor, id: string): Promise<CodingSessionDetailDto> {
    const session = await requireSession(actor, id);
    const [languages, events] = await Promise.all([
      sessionsRepository.languages(id),
      sessionsRepository.eventCounts(id),
    ]);
    return {
      ...toSessionDto(session),
      languages,
      events: events
        .map((row) => ({ type: row.type, count: row._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  },

  async list(userId: string, query: ListQuery) {
    const where: Prisma.CodingSessionWhereInput = {
      ...sessionWhere(userId, query),
      ...(query.source ? { source: query.source } : {}),
    };
    const { skip, take } = skipTake(query.page, query.pageSize);
    const [total, sessions] = await sessionsRepository.list(where, ORDER[query.sort], skip, take);
    return { data: sessions.map(toSessionDto), meta: pageMeta(query.page, query.pageSize, total) };
  },

  async remove(userId: string, id: string) {
    await requireSession({ userId }, id);
    await sessionsRepository.delete(id);
  },

  /** Background job: ends sessions whose editor stopped sending heartbeats. */
  async closeStaleSessions(now = new Date()) {
    const closed = await sessionsRepository.closeStale({
      OR: [
        { lastHeartbeatAt: { lt: new Date(now.getTime() - STALE_SESSION_MS) } },
        { lastHeartbeatAt: null, startedAt: { lt: new Date(now.getTime() - STALE_SESSION_MS) } },
      ],
    });
    await Promise.all(closed.map(announceRecorded));
    return closed.length;
  },
};
