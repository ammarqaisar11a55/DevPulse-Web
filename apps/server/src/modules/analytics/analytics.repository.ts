import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import {
  EFFECTIVE_END,
  overlapConditions,
  overlapRatio,
  scopeConditions,
  sessionsOverlapping,
  type SessionScope,
} from '../../database/session-time';

/*
 * Aggregation queries for analytics. All time is active coding time, attributed to periods in
 * proportion to overlap (see session-time.ts). Buckets are local calendar periods generated in
 * the user's time zone, so DST changes are handled by PostgreSQL.
 *
 * These run directly against coding_sessions, backed by the (user_id, started_at) index. If
 * volumes grow, the same shapes can be served from a pre-aggregated daily table.
 */

const at = (value: Date) => Prisma.sql`${value}::timestamptz`;

export const analyticsRepository = {
  /** Active seconds and sessions started, per local day from `fromDate` to `toDate` inclusive. */
  async dailySeries(scope: SessionScope, fromDate: string, toDate: string, timeZone: string) {
    const dayStart = Prisma.sql`(d AT TIME ZONE ${timeZone})`;
    const dayEnd = Prisma.sql`((d + interval '1 day') AT TIME ZONE ${timeZone})`;
    const rows = await prisma.$queryRaw<{ date: string; seconds: number; sessions: number }[]>`
      SELECT to_char(d, 'YYYY-MM-DD') AS date,
             COALESCE(SUM(cs.active_seconds * ${overlapRatio(dayStart, dayEnd)}), 0)::float8 AS seconds,
             COUNT(cs.id) FILTER (WHERE cs.started_at >= ${dayStart} AND cs.started_at < ${dayEnd})::int AS sessions
      FROM generate_series(${fromDate}::timestamp, ${toDate}::timestamp, interval '1 day') AS d
      LEFT JOIN coding_sessions cs ON ${scopeConditions(scope)} AND ${overlapConditions(dayStart, dayEnd)}
      GROUP BY d
      ORDER BY d
    `;
    return rows.map((row) => ({ ...row, seconds: Math.round(row.seconds) }));
  },

  /** Active seconds in [from, to) and the number of sessions that started in it. */
  async totals(scope: SessionScope, from: Date, to: Date) {
    const rows = await prisma.$queryRaw<{ seconds: number; sessions: number }[]>`
      SELECT COALESCE(SUM(cs.active_seconds * ${overlapRatio(at(from), at(to))}), 0)::float8 AS seconds,
             COUNT(*) FILTER (WHERE cs.started_at >= ${at(from)} AND cs.started_at < ${at(to)})::int AS sessions
      FROM coding_sessions cs
      WHERE ${sessionsOverlapping(scope, from, to)}
    `;
    return { seconds: Math.round(rows[0]?.seconds ?? 0), sessions: rows[0]?.sessions ?? 0 };
  },

  /** Active seconds per project (null id = unassigned), largest first. */
  async byProject(scope: SessionScope, from: Date, to: Date) {
    const rows = await prisma.$queryRaw<
      { id: string | null; label: string | null; color: string | null; seconds: number }[]
    >`
      SELECT p.id, p.name AS label, p.color,
             SUM(cs.active_seconds * ${overlapRatio(at(from), at(to))})::float8 AS seconds
      FROM coding_sessions cs
      LEFT JOIN projects p ON p.id = cs.project_id
      WHERE ${sessionsOverlapping(scope, from, to)}
      GROUP BY p.id, p.name, p.color
      HAVING SUM(cs.active_seconds) > 0
      ORDER BY seconds DESC
    `;
    return rows.map((row) => ({
      ...row,
      label: row.label ?? 'No project',
      seconds: Math.round(row.seconds),
    }));
  },

  /** Active seconds per language from the per-session breakdowns, largest first. */
  async byLanguage(scope: SessionScope, from: Date, to: Date) {
    const rows = await prisma.$queryRaw<{ language: string; seconds: number }[]>`
      SELECT sl.language, SUM(sl.active_seconds * ${overlapRatio(at(from), at(to))})::float8 AS seconds
      FROM coding_sessions cs
      JOIN session_languages sl ON sl.session_id = cs.id
      WHERE ${sessionsOverlapping(scope, from, to)}
      GROUP BY sl.language
      HAVING SUM(sl.active_seconds) > 0
      ORDER BY seconds DESC
    `;
    return rows.map((row) => ({ language: row.language, seconds: Math.round(row.seconds) }));
  },

  /** Sessions overlapping [from, to) positioned for a pulse strip. */
  dayBlocks(scope: SessionScope, from: Date, to: Date) {
    return prisma.$queryRaw<
      {
        id: string;
        started_at: Date;
        ended_at: Date;
        active_ratio: number;
        project_name: string | null;
        project_color: string | null;
      }[]
    >`
      SELECT cs.id, cs.started_at, ${EFFECTIVE_END} AS ended_at,
             CASE WHEN cs.duration_seconds > 0 THEN cs.active_seconds::float8 / cs.duration_seconds ELSE 1 END AS active_ratio,
             p.name AS project_name, p.color AS project_color
      FROM coding_sessions cs
      LEFT JOIN projects p ON p.id = cs.project_id
      WHERE ${sessionsOverlapping(scope, from, to)}
      ORDER BY cs.started_at
    `;
  },

  /** Distinct local dates with activity since `since`, newest first (for streaks). */
  async activeDates(userId: string, since: Date, timeZone: string) {
    const rows = await prisma.$queryRaw<{ date: string }[]>`
      SELECT DISTINCT to_char(cs.started_at AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS date
      FROM coding_sessions cs
      WHERE cs.user_id = ${userId}::uuid AND cs.started_at >= ${at(since)} AND cs.active_seconds > 0
      ORDER BY date DESC
    `;
    return rows.map((row) => row.date);
  },

  /** Projects with activity in [from, to). */
  async activeProjectCount(userId: string, from: Date, to: Date) {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT cs.project_id)::int AS count
      FROM coding_sessions cs
      WHERE ${sessionsOverlapping({ userId }, from, to)} AND cs.project_id IS NOT NULL
    `;
    return rows[0]?.count ?? 0;
  },

  totalProjectCount(userId: string) {
    return prisma.project.count({ where: { userId, archivedAt: null } });
  },

  async hasAnySession(userId: string) {
    return (
      (await prisma.codingSession.findFirst({ where: { userId }, select: { id: true } })) !== null
    );
  },
};
