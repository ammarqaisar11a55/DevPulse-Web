import {
  MAX_ANALYTICS_RANGE_DAYS,
  type AnalyticsReportDto,
  type AnalyticsTotals,
  type analyticsQuerySchema,
  type BreakdownItem,
  type DayBlock,
  type Granularity,
  type OverviewDto,
  type SeriesPoint,
  type SessionLengthBucket,
} from '@devpulse/shared';
import type { z } from 'zod';
import type { SessionScope } from '../../database/session-time';
import { badRequest } from '../../utils/errors';
import {
  addDays,
  calendarBoundaries,
  diffInDays,
  formatLocalDate,
  parseLocalDate,
  startOfLocalDay,
  startOfLocalWeek,
  toLocalDate,
  weekday,
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

type AnalyticsQuery = z.output<typeof analyticsQuerySchema>;

const DEFAULT_RANGE_DAYS = 30;

const SESSION_LENGTH_LABELS: Record<SessionLengthBucket['key'], string> = {
  short: 'Under 30 minutes',
  medium: '30 to 90 minutes',
  long: 'Over 90 minutes',
};

/** Resolves a query into an instant range and its local calendar dates. */
export function resolveAnalyticsRange(
  query: Pick<AnalyticsQuery, 'from' | 'to'>,
  timeZone: string,
  weekStartsOn: number,
  now = new Date(),
) {
  const b = calendarBoundaries(now, timeZone, weekStartsOn);
  const to = query.to ?? b.tomorrowStart;
  const from = query.from ?? startOfLocalDay(addDays(b.today, -(DEFAULT_RANGE_DAYS - 1)), timeZone);
  if (from.getTime() >= to.getTime()) {
    throw badRequest('The start of the range must be before its end', [
      { path: 'from', message: 'Must be before to' },
    ]);
  }
  const fromDate = toLocalDate(from, timeZone);
  const toDate = toLocalDate(new Date(to.getTime() - 1), timeZone);
  const days = diffInDays(fromDate, toDate) + 1;
  if (days > MAX_ANALYTICS_RANGE_DAYS) {
    throw badRequest(`Ranges are limited to ${MAX_ANALYTICS_RANGE_DAYS} days`, [
      { path: 'from', message: 'Range is too long' },
    ]);
  }
  return { from, to, fromDate: formatLocalDate(fromDate), toDate: formatLocalDate(toDate), days };
}

/** Rolls a daily series up into week or month buckets keyed by the bucket's first day. */
export function rollUp(
  daily: SeriesPoint[],
  granularity: Granularity,
  weekStartsOn: number,
): SeriesPoint[] {
  if (granularity === 'day') return daily;
  const buckets = new Map<string, SeriesPoint>();
  for (const point of daily) {
    const date = parseLocalDate(point.date);
    const key =
      granularity === 'week'
        ? formatLocalDate(startOfLocalWeek(date, weekStartsOn))
        : formatLocalDate({ year: date.year, month: date.month, day: 1 });
    const bucket = buckets.get(key) ?? { date: key, seconds: 0, sessions: 0 };
    bucket.seconds += point.seconds;
    bucket.sessions += point.sessions;
    buckets.set(key, bucket);
  }
  return [...buckets.values()];
}

function scopeFrom(userId: string, query: AnalyticsQuery): SessionScope {
  return {
    userId,
    projectId: query.projectId,
    deviceId: query.deviceId,
    language: query.language,
    repository: query.repository,
  };
}

async function totalsFor(
  scope: SessionScope,
  from: Date,
  to: Date,
  fromDate: string,
  toDate: string,
  days: number,
  timeZone: string,
) {
  const [daily, lengths, totals] = await Promise.all([
    analyticsRepository.dailySeries(scope, fromDate, toDate, timeZone),
    analyticsRepository.sessionLengths(scope, from, to),
    analyticsRepository.totals(scope, from, to),
  ]);
  const startedSeconds = lengths.reduce((sum, bucket) => sum + bucket.seconds, 0);
  const startedCount = lengths.reduce((sum, bucket) => sum + bucket.sessions, 0);
  const summary: AnalyticsTotals = {
    seconds: totals.seconds,
    sessions: totals.sessions,
    activeDays: daily.filter((point) => point.seconds > 0).length,
    dailyAverageSeconds: Math.round(totals.seconds / days),
    averageSessionSeconds: startedCount > 0 ? Math.round(startedSeconds / startedCount) : 0,
  };
  return { daily, lengths, summary };
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

  /** Full analytics report for a range and filter set. */
  async report(userId: string, query: AnalyticsQuery): Promise<AnalyticsReportDto> {
    const { timezone, weekStartsOn } = await getUserCalendar(userId);
    const range = resolveAnalyticsRange(query, timezone, weekStartsOn);
    const scope = scopeFrom(userId, query);

    const spanMs = range.to.getTime() - range.from.getTime();
    const previousFrom = new Date(range.from.getTime() - spanMs);
    const previousFromDate = formatLocalDate(addDays(parseLocalDate(range.fromDate), -range.days));
    const previousToDate = formatLocalDate(addDays(parseLocalDate(range.fromDate), -1));

    const [current, previous, hourly, projects, languages, devices] = await Promise.all([
      totalsFor(scope, range.from, range.to, range.fromDate, range.toDate, range.days, timezone),
      totalsFor(
        scope,
        previousFrom,
        range.from,
        previousFromDate,
        previousToDate,
        range.days,
        timezone,
      ),
      analyticsRepository.hourOfDay(scope, range.from, range.to, timezone),
      analyticsRepository.byProject(scope, range.from, range.to),
      analyticsRepository.byLanguage(scope, range.from, range.to),
      analyticsRepository.byDevice(scope, range.from, range.to),
    ]);

    const weekdays = Array.from({ length: 7 }, (_, day) => ({ weekday: day, seconds: 0 }));
    for (const point of current.daily)
      weekdays[weekday(parseLocalDate(point.date))]!.seconds += point.seconds;

    const lengthsByKey = new Map(current.lengths.map((bucket) => [bucket.bucket, bucket]));
    const sessionLengths = (['short', 'medium', 'long'] as const).map((key) => ({
      key,
      label: SESSION_LENGTH_LABELS[key],
      sessions: lengthsByKey.get(key)?.sessions ?? 0,
      seconds: lengthsByKey.get(key)?.seconds ?? 0,
    }));

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        fromDate: range.fromDate,
        toDate: range.toDate,
        days: range.days,
        timezone,
      },
      totals: current.summary,
      previous: previous.summary,
      daily: current.daily,
      weekly: rollUp(current.daily, 'week', weekStartsOn),
      monthly: rollUp(current.daily, 'month', weekStartsOn),
      hourly,
      weekdays,
      projects: toBreakdown(projects),
      languages: languages.map((row) => ({
        id: row.language,
        label: row.language,
        color: null,
        seconds: row.seconds,
      })),
      devices,
      sessionLengths,
    };
  },

  /** Coding time series at the requested granularity (for API clients). */
  async codingTime(userId: string, query: AnalyticsQuery) {
    const { timezone, weekStartsOn } = await getUserCalendar(userId);
    const range = resolveAnalyticsRange(query, timezone, weekStartsOn);
    const daily = await analyticsRepository.dailySeries(
      scopeFrom(userId, query),
      range.fromDate,
      range.toDate,
      timezone,
    );
    const series = rollUp(daily, query.granularity, weekStartsOn);
    return {
      granularity: query.granularity,
      timezone,
      fromDate: range.fromDate,
      toDate: range.toDate,
      totalSeconds: daily.reduce((sum, point) => sum + point.seconds, 0),
      series,
    };
  },
};
