import type { OverviewDto } from '@devpulse/shared';
import { api } from '@/lib/api-client';

export const overviewKey = ['analytics', 'overview'] as const;

export const dashboardApi = {
  overview: (signal?: AbortSignal) => api.get<OverviewDto>('/analytics/overview', { signal }),
};
