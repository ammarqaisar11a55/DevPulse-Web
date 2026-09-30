import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/** Upper bound on a single session's length; keeps range scans on (user_id, started_at) bounded. */
export const MAX_SESSION_SECONDS = 24 * 60 * 60;

export interface SessionScope {
  userId: string;
  projectId?: string;
  deviceId?: string;
  language?: string;
}

/**
 * End of a session for time attribution. Ongoing sessions end at their latest heartbeat.
 * Expects the coding_sessions table to be aliased as `cs`.
 */
export const EFFECTIVE_END = Prisma.sql`COALESCE(cs.ended_at, cs.last_heartbeat_at, cs.started_at + make_interval(secs => cs.duration_seconds))`;

/**
 * Share (0–1) of a session's wall-clock span that overlaps [from, to). Active seconds are
 * attributed proportionally, so a session spanning midnight counts towards both days.
 */
export function overlapRatio(from: Prisma.Sql, to: Prisma.Sql) {
  return Prisma.sql`LEAST(1.0, GREATEST(0.0,
    EXTRACT(EPOCH FROM (LEAST(${EFFECTIVE_END}, ${to}) - GREATEST(cs.started_at, ${from})))
  ) / GREATEST(EXTRACT(EPOCH FROM (${EFFECTIVE_END} - cs.started_at)), 1.0))`;
}

/** WHERE clause selecting a user's sessions that overlap [from, to), using the started_at index. */
export function sessionsOverlapping(scope: SessionScope, from: Date, to: Date) {
  const lowerBound = new Date(from.getTime() - MAX_SESSION_SECONDS * 1000);
  const conditions = [
    Prisma.sql`cs.user_id = ${scope.userId}::uuid`,
    Prisma.sql`cs.started_at < ${to}`,
    Prisma.sql`cs.started_at >= ${lowerBound}`,
    Prisma.sql`${EFFECTIVE_END} > ${from}`,
  ];
  if (scope.projectId) conditions.push(Prisma.sql`cs.project_id = ${scope.projectId}::uuid`);
  if (scope.deviceId) conditions.push(Prisma.sql`cs.device_id = ${scope.deviceId}::uuid`);
  if (scope.language) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM session_languages sl WHERE sl.session_id = cs.id AND sl.language = ${scope.language})`,
    );
  }
  return Prisma.join(conditions, ' AND ');
}

/** Active coding seconds within [from, to), with proportional attribution at the edges. */
export async function activeSecondsInRange(scope: SessionScope, from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ seconds: number | null }[]>`
    SELECT COALESCE(SUM(cs.active_seconds * ${overlapRatio(Prisma.sql`${from}`, Prisma.sql`${to}`)}), 0)::float8 AS seconds
    FROM coding_sessions cs
    WHERE ${sessionsOverlapping(scope, from, to)}
  `;
  return Math.round(rows[0]?.seconds ?? 0);
}
