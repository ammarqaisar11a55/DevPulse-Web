import type { LeaderboardDto, LeaderboardPeriod } from '@devpulse/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { overlapConditions, overlapRatio } from '../../database/session-time';

/** Current UTC day, ISO week (Monday start) or month, ending now. */
export function leaderboardWindow(period: LeaderboardPeriod, now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  let from: Date;
  if (period === 'day') from = new Date(Date.UTC(y, m, d));
  else if (period === 'week') from = new Date(Date.UTC(y, m, d - ((now.getUTCDay() + 6) % 7)));
  else from = new Date(Date.UTC(y, m, 1));
  return { from, to: now };
}

interface RankedRow {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  seconds: number;
  rank: number;
}

export const leaderboardService = {
  async get(
    userId: string,
    period: LeaderboardPeriod,
    limit: number,
    now = new Date(),
  ): Promise<LeaderboardDto> {
    const { from, to } = leaderboardWindow(period, now);
    const fromSql = Prisma.sql`${from}::timestamptz`;
    const toSql = Prisma.sql`${to}::timestamptz`;

    // Rank every opted-in user with time in the window; return the top rows plus the caller.
    const rows = await prisma.$queryRaw<(RankedRow & { participants: number; position: number })[]>`
      WITH totals AS (
        SELECT cs.user_id, SUM(cs.active_seconds * ${overlapRatio(fromSql, toSql)})::float8 AS seconds
        FROM coding_sessions cs
        JOIN user_settings s ON s.user_id = cs.user_id AND s.show_on_leaderboard
        WHERE ${overlapConditions(fromSql, toSql)}
        GROUP BY cs.user_id
        HAVING SUM(cs.active_seconds * ${overlapRatio(fromSql, toSql)}) >= 60
      ),
      ranked AS (
        SELECT t.user_id, u.username, u.full_name, u.avatar_url, ROUND(t.seconds)::int AS seconds,
               RANK() OVER (ORDER BY t.seconds DESC)::int AS rank,
               COUNT(*) OVER ()::int AS participants,
               ROW_NUMBER() OVER (ORDER BY t.seconds DESC, u.username)::int AS position
        FROM totals t
        JOIN users u ON u.id = t.user_id
      )
      SELECT user_id, username, full_name, avatar_url, seconds, rank, participants, position
      FROM ranked
      WHERE position <= ${limit} OR user_id = ${userId}::uuid
      ORDER BY position
    `;

    const settings = await prisma.userSetting.findUnique({
      where: { userId },
      select: { showOnLeaderboard: true },
    });
    const optedIn = settings?.showOnLeaderboard ?? false;
    const mine = rows.find((row) => row.user_id === userId);

    // The caller's own time is always shown to them, even when they are not listed.
    let mySeconds = mine?.seconds ?? 0;
    if (!mine) {
      const own = await prisma.$queryRaw<{ seconds: number }[]>`
        SELECT COALESCE(SUM(cs.active_seconds * ${overlapRatio(fromSql, toSql)}), 0)::float8 AS seconds
        FROM coding_sessions cs
        WHERE cs.user_id = ${userId}::uuid AND ${overlapConditions(fromSql, toSql)}
      `;
      mySeconds = Math.round(own[0]?.seconds ?? 0);
    }

    return {
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      participants: rows[0]?.participants ?? 0,
      entries: rows
        .filter((row) => row.position <= limit)
        .map((row) => ({
          rank: row.rank,
          username: row.username,
          fullName: row.full_name,
          avatarUrl: row.avatar_url,
          seconds: row.seconds,
          isCurrentUser: row.user_id === userId,
        })),
      me: { optedIn, rank: mine?.rank ?? null, seconds: mySeconds },
    };
  },
};
