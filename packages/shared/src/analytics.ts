import type { CodingSessionDto } from './activity';

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
