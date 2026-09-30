import { z } from 'zod';

export const LEADERBOARD_PERIODS = ['day', 'week', 'month'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export const LEADERBOARD_MAX_ENTRIES = 50;

export const leaderboardQuerySchema = z.object({
  period: z.enum(LEADERBOARD_PERIODS).default('week'),
  limit: z.coerce.number().int().min(1).max(LEADERBOARD_MAX_ENTRIES).default(25),
});
export type LeaderboardQuery = Partial<z.output<typeof leaderboardQuerySchema>>;

/**
 * A public leaderboard row. Only opted-in users appear, and only these fields are exposed:
 * no projects, repositories, languages or devices.
 */
export interface LeaderboardEntry {
  rank: number;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  seconds: number;
  isCurrentUser: boolean;
}

export interface LeaderboardDto {
  period: LeaderboardPeriod;
  /** Periods are UTC so every participant is ranked over the same window. */
  from: string;
  to: string;
  participants: number;
  entries: LeaderboardEntry[];
  me: {
    optedIn: boolean;
    /** Rank among participants; null when not opted in or no time in the period. */
    rank: number | null;
    seconds: number;
  };
}
