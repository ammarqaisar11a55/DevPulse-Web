import type {
  ActivityFilterOptions,
  ingestEventsSchema,
  IngestEventsResult,
  TimelineResponse,
  timelineQuerySchema,
} from '@devpulse/shared';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../database/prisma';
import { badRequest, notFound } from '../../utils/errors';
import { toSessionDto } from '../sessions/session.mapper';
import { sessionWhere, sessionsRepository } from '../sessions/sessions.repository';
import type { SessionActor } from '../sessions/sessions.service';

type TimelineQuery = z.output<typeof timelineQuerySchema>;
type IngestEvents = z.output<typeof ingestEventsSchema>;

/** Opaque keyset cursor: the last item's start time and id. */
function encodeCursor(startedAt: Date, id: string) {
  return Buffer.from(`${startedAt.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string) {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const startedAt = iso ? new Date(iso) : null;
  if (!startedAt || Number.isNaN(startedAt.getTime()) || !id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw badRequest('Invalid cursor', [{ path: 'cursor', message: 'Invalid cursor' }]);
  }
  return { startedAt, id };
}

export const activityService = {
  /** Sessions newest-first with keyset pagination, for the activity timeline. */
  async timeline(userId: string, query: TimelineQuery): Promise<TimelineResponse> {
    const where: Prisma.CodingSessionWhereInput = sessionWhere(userId, query);
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      where.AND = [
        {
          OR: [
            { startedAt: { lt: cursor.startedAt } },
            { startedAt: cursor.startedAt, id: { lt: cursor.id } },
          ],
        },
      ];
    }
    const rows = await sessionsRepository.findPage(
      where,
      [{ startedAt: 'desc' }, { id: 'desc' }],
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      data: page.map(toSessionDto),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last.startedAt, last.id) : null,
    };
  },

  /** Values that exist in the user's data, for filter dropdowns. */
  async filterOptions(userId: string): Promise<ActivityFilterOptions> {
    const [projects, devices, languages, repositories] = await Promise.all([
      prisma.project.findMany({
        where: { userId },
        select: { id: true, name: true, color: true },
        orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
      }),
      prisma.device.findMany({
        where: { userId },
        select: { id: true, name: true, platform: true },
        orderBy: { name: 'asc' },
      }),
      prisma.$queryRaw<{ language: string }[]>`
        SELECT DISTINCT sl.language FROM session_languages sl
        JOIN coding_sessions cs ON cs.id = sl.session_id
        WHERE cs.user_id = ${userId}::uuid ORDER BY sl.language
      `,
      prisma.codingSession.findMany({
        where: { userId, repository: { not: null } },
        distinct: ['repository'],
        select: { repository: true },
        orderBy: { repository: 'asc' },
      }),
    ]);
    return {
      projects: projects.map((project) => ({ ...project, color: project.color ?? 'slate' })),
      devices,
      languages: languages.map((row) => row.language),
      repositories: repositories.flatMap((row) => (row.repository ? [row.repository] : [])),
    };
  },

  /**
   * Stores a batch of editor events. Referenced sessions and projects must belong to the
   * caller (and sessions to the calling device). Retried events are deduplicated by
   * (device, clientEventId).
   */
  async ingestEvents(actor: SessionActor, input: IngestEvents): Promise<IngestEventsResult> {
    const sessionIds = [
      ...new Set(input.events.flatMap((event) => (event.sessionId ? [event.sessionId] : []))),
    ];
    const projectIds = [
      ...new Set(input.events.flatMap((event) => (event.projectId ? [event.projectId] : []))),
    ];

    const [sessions, projects] = await Promise.all([
      sessionIds.length
        ? prisma.codingSession.findMany({
            where: {
              id: { in: sessionIds },
              userId: actor.userId,
              ...(actor.deviceId ? { deviceId: actor.deviceId } : {}),
            },
            select: { id: true, projectId: true },
          })
        : [],
      projectIds.length
        ? prisma.project.findMany({
            where: { id: { in: projectIds }, userId: actor.userId },
            select: { id: true },
          })
        : [],
    ]);
    const sessionProject = new Map(sessions.map((session) => [session.id, session.projectId]));
    const ownedProjects = new Set(projects.map((project) => project.id));

    for (const event of input.events) {
      if (event.sessionId && !sessionProject.has(event.sessionId)) throw notFound('Session');
      if (event.projectId && !ownedProjects.has(event.projectId)) throw notFound('Project');
    }

    const result = await prisma.activityEvent.createMany({
      data: input.events.map((event) => ({
        userId: actor.userId,
        deviceId: actor.deviceId ?? null,
        clientEventId: actor.deviceId ? (event.clientEventId ?? null) : null,
        sessionId: event.sessionId ?? null,
        projectId:
          event.projectId ??
          (event.sessionId ? (sessionProject.get(event.sessionId) ?? null) : null),
        type: event.type,
        occurredAt: event.occurredAt,
        language: event.language ?? null,
        metadata: event.metadata ?? undefined,
      })),
      skipDuplicates: true,
    });
    return { accepted: result.count, duplicates: input.events.length - result.count };
  },
};
