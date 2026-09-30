import type { BreakdownItem, DayBlock, OverviewDto } from '@devpulse/shared';
import {
  addDays,
  calendarBoundaries,
  formatLocalDate,
  parseLocalDate,
  diffInDays,
} from '../../utils/time';
import { toSessionDto } from '../sessions/session.mapper';
import { sessionsRepository } from '../sessions/sessions.repository';
import { getUserCalendar } from '../users/user-context';
import { analyticsRepository } from './analytics.repository';

const TOP_ITEMS = 5;
const STREAK_LOOKBACK_DAYS = 400;

/** Consecutive active days ending today, or ending yesterday if today has no activity yet. */
export function computeStreak(activeDatesDesc: string[], today: string) {
  if (activeDatesDesc.length === 0) return 0;
  const todayDate = parseLocalDate(today);
  const newest = parseLocalDate(activeDatesDesc[0]!);
  const gap = diffInDays(newest, todayDate);
  if (gap > 1) return 0;
  let streak = 1;
  for (let index = 1; index < activeDatesDesc.length; index += 1) {
    const expected = formatLocalDate(addDays(parseLocalDate(activeDatesDesc[index - 1]!), -1));
    if (activeDatesDesc[index] !== expected) break;
    streak += 1;
  }
  return streak;
}

export function toBreakdown(
  rows: { id: string | null; label: string; color: string | null; seconds: number }[],
): BreakdownItem[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    color: row.color,
    seconds: row.seconds,
  }));
}

export const analyticsService = {
  /** Everything the dashboard needs in one round trip. */
  async overview(userId: string, now = new Date()): Promise<OverviewDto> {
    const { timezone, weekStartsOn } = await getUserCalendar(userId);
    const b = calendarBoundaries(now, timezone, weekStartsOn);
    const scope = { userId };

    // Compare against the same elapsed span of the previous period, not its full length.
    const sinceToday = now.getTime() - b.todayStart.getTime();
    const sinceWeek = now.getTime() - b.weekStart.getTime();
    const yesterdaySoFar = new Date(b.yesterdayStart.getTime() + sinceToday);
    const previousWeekSoFar = new Date(b.previousWeekStart.getTime() + sinceWeek);

    const [
      today,
      yesterday,
      week,
      previousWeek,
      last7Days,
      blocks,
      projects,
      languages,
      activeDates,
      activeProjects,
      totalProjects,
      recent,
      hasAny,
    ] = await Promise.all([
      analyticsRepository.totals(scope, b.todayStart, now),
      analyticsRepository.totals(scope, b.yesterdayStart, yesterdaySoFar),
      analyticsRepository.totals(scope, b.weekStart, now),
      analyticsRepository.totals(scope, b.previousWeekStart, previousWeekSoFar),
      analyticsRepository.dailySeries(
        scope,
        formatLocalDate(addDays(b.today, -6)),
        formatLocalDate(b.today),
        timezone,
      ),
      analyticsRepository.dayBlocks(scope, b.todayStart, b.tomorrowStart),
      analyticsRepository.byProject(scope, b.weekStart, now),
      analyticsRepository.byLanguage(scope, b.weekStart, now),
      analyticsRepository.activeDates(
        userId,
        new Date(now.getTime() - STREAK_LOOKBACK_DAYS * 86_400_000),
        timezone,
      ),
      analyticsRepository.activeProjectCount(userId, b.weekStart, now),
      analyticsRepository.totalProjectCount(userId),
      sessionsRepository.findPage({ userId }, [{ startedAt: 'desc' }, { id: 'desc' }], TOP_ITEMS),
      analyticsRepository.hasAnySession(userId),
    ]);

    const todayBlocks: DayBlock[] = blocks.map((block) => ({
      id: block.id,
      startedAt: block.started_at.toISOString(),
      endedAt: block.ended_at.toISOString(),
      activeRatio: Math.min(1, Math.max(0, block.active_ratio)),
      projectName: block.project_name,
      projectColor: block.project_color,
    }));

    return {
      timezone,
      today: { seconds: today.seconds, previousSeconds: yesterday.seconds },
      week: { seconds: week.seconds, previousSeconds: previousWeek.seconds },
      sessions: { count: week.sessions, previousCount: previousWeek.sessions },
      projects: { active: activeProjects, total: totalProjects },
      streakDays: computeStreak(activeDates, formatLocalDate(b.today)),
      last7Days,
      todayBlocks,
      topProjects: toBreakdown(projects),
      topLanguages: languages.map((row) => ({
        id: row.language,
        label: row.language,
        color: null,
        seconds: row.seconds,
      })),
      recentSessions: recent.map(toSessionDto),
      hasAnyActivity: hasAny,
    };
  },
};
