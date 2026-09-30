import { z } from 'zod';
import { activityFiltersSchema, type CodingSessionDto } from './activity';

/** Active coding time for one local calendar day. */
export interface DailyPoint {
  /** YYYY-MM-DD in the user's time zone. */
  date: string;
  seconds: number;
  /** Sessions that started on this day. */
  sessions: number;
}

export interface BreakdownItem {
  /** Project/device id, language id, or null for unassigned time. */
  id: string | null;
  label: string;
  color: string | null;
  seconds: number;
}

/** A session positioned on a 24-hour day, for pulse strips. */
export interface DayBlock {
  id: string;
  startedAt: string;
  endedAt: string;
  activeRatio: number;
  projectName: string | null;
  projectColor: string | null;
}

export interface PeriodComparison {
  seconds: number;
  /** Same elapsed span of the previous period, for a fair comparison. */
  previousSeconds: number;
}

export interface OverviewDto {
  timezone: string;
  today: PeriodComparison;
  week: PeriodComparison;
  sessions: { count: number; previousCount: number };
  projects: { active: number; total: number };
  /** Consecutive days with coding activity, ending today (or yesterday). */
  streakDays: number;
  last7Days: DailyPoint[];
  todayBlocks: DayBlock[];
  topProjects: BreakdownItem[];
  topLanguages: BreakdownItem[];
  recentSessions: CodingSessionDto[];
  hasAnyActivity: boolean;
}

/** Longest range a single analytics request may cover. */
export const MAX_ANALYTICS_RANGE_DAYS = 366;

export const GRANULARITIES = ['day', 'week', 'month'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** Filters for analytics endpoints. `from`/`to` default to the last 30 days. */
export const analyticsQuerySchema = activityFiltersSchema.extend({
  granularity: z.enum(GRANULARITIES).default('day'),
});
export type AnalyticsQuery = Partial<z.output<typeof analyticsQuerySchema>>;

/** Active coding time for a day, week or month bucket (period start as YYYY-MM-DD). */
export interface SeriesPoint {
  date: string;
  seconds: number;
  sessions: number;
}

export interface AnalyticsTotals {
  seconds: number;
  sessions: number;
  /** Days in the range with any coding. */
  activeDays: number;
  /** Mean active time per calendar day in the range. */
  dailyAverageSeconds: number;
  averageSessionSeconds: number;
}

export interface SessionLengthBucket {
  key: 'short' | 'medium' | 'long';
  label: string;
  sessions: number;
  seconds: number;
}

export interface AnalyticsReportDto {
  range: {
    from: string;
    to: string;
    fromDate: string;
    toDate: string;
    days: number;
    timezone: string;
  };
  totals: AnalyticsTotals;
  /** Totals for the preceding range of the same length. */
  previous: AnalyticsTotals;
  daily: SeriesPoint[];
  weekly: SeriesPoint[];
  monthly: SeriesPoint[];
  /** 24 entries, local hour 0–23. */
  hourly: { hour: number; seconds: number }[];
  /** 7 entries, 0 = Sunday. */
  weekdays: { weekday: number; seconds: number }[];
  projects: BreakdownItem[];
  languages: BreakdownItem[];
  devices: BreakdownItem[];
  sessionLengths: SessionLengthBucket[];
}
