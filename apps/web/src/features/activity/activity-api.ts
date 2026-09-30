import type { ActivityFilterOptions, TimelineQuery, TimelineResponse } from '@devpulse/shared';
import { api, apiRequest } from '@/lib/api-client';

export const activityKeys = {
  filters: ['activity', 'filters'] as const,
  timeline: (query: TimelineQuery) => ['activity', 'timeline', query] as const,
};

export const activityApi = {
  filters: (signal?: AbortSignal) =>
    api.get<ActivityFilterOptions>('/activity/filters', { signal }),
  timeline: (query: TimelineQuery, signal?: AbortSignal) =>
    apiRequest<TimelineResponse>('/activity/timeline', { query: { ...query }, signal }),
};
