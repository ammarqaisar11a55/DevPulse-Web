import type { LeaderboardDto, LeaderboardPeriod } from '@devpulse/shared';
import { api } from '@/lib/api-client';

export const leaderboardKey = (period: LeaderboardPeriod) => ['leaderboard', period] as const;

export const leaderboardApi = {
  get: (period: LeaderboardPeriod, signal?: AbortSignal) =>
    api.get<LeaderboardDto>('/leaderboard', { query: { period, limit: 50 }, signal }),
};
