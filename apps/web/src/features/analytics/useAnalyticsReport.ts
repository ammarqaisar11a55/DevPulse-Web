import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AnalyticsReportDto } from '@devpulse/shared';
import { api } from '@/lib/api-client';

export interface ReportFilters {
  from?: string;
  to?: string;
  projectId?: string;
  language?: string;
  deviceId?: string;
  repository?: string;
}

/** Loads the analytics report for a range and filter set, keeping old data while refetching. */
export function useAnalyticsReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ['analytics', 'report', filters],
    queryFn: ({ signal }) =>
      api.get<AnalyticsReportDto>('/analytics/report', { query: { ...filters }, signal }),
    placeholderData: keepPreviousData,
  });
}
