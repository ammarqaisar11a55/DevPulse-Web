import type { AnalyticsReportDto, Granularity } from '@devpulse/shared';
import { BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { BreakdownList } from '@/components/BreakdownList';
import { DailyBarChart } from '@/components/charts/DailyBarChart';
import { HourlyChart } from '@/components/charts/HourlyChart';
import { WeekdayChart } from '@/components/charts/WeekdayChart';
import { PageHeader } from '@/components/PageHeader';
import { StatStrip, type Stat } from '@/components/StatStrip';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ActivityFilterBar } from '@/features/activity/components/ActivityFilterBar';
import { useActivityFilters } from '@/features/activity/useActivityFilters';
import { useCurrentUser } from '@/features/auth/auth-context';
import { projectColor } from '@/lib/colors';
import { formatDuration, percentChange } from '@/lib/format';
import { languageName } from '@/lib/languages';
import { foldSeries } from '@/lib/series';
import type { RangePreset } from '@/lib/timezone';
import { useAnalyticsReport } from './useAnalyticsReport';

const RANGES: RangePreset[] = ['today', 'yesterday', '7d', '30d', '90d'];

const SHORT_LENGTH_LABELS: Record<'short' | 'medium' | 'long', string> = {
  short: 'Under 30 min',
  medium: '30 to 90 min',
  long: 'Over 90 min',
};

function summaryStats(report: AnalyticsReportDto | undefined): Stat[] {
  const t = report?.totals;
  const p = report?.previous;
  return [
    {
      label: 'Coding time',
      value: formatDuration(t?.seconds ?? 0),
      change: t && p ? percentChange(t.seconds, p.seconds) : null,
      changeLabel: 'vs previous period',
    },
    {
      label: 'Daily average',
      value: formatDuration(t?.dailyAverageSeconds ?? 0),
      change: t && p ? percentChange(t.dailyAverageSeconds, p.dailyAverageSeconds) : null,
      changeLabel: 'vs previous period',
    },
    {
      label: 'Active days',
      value: `${t?.activeDays ?? 0}`,
      hint: report
        ? `of ${report.range.days} ${report.range.days === 1 ? 'day' : 'days'}`
        : undefined,
    },
    {
      label: 'Average session',
      value: formatDuration(t?.averageSessionSeconds ?? 0),
      hint: t ? `${t.sessions} ${t.sessions === 1 ? 'session' : 'sessions'}` : undefined,
    },
  ];
}

/** Picks a readable bucket size for the range length. */
function defaultGranularity(days: number): Granularity {
  if (days > 120) return 'month';
  if (days > 45) return 'week';
  return 'day';
}

export function AnalyticsPage() {
  const user = useCurrentUser();
  const filters = useActivityFilters('30d');
  const report = useAnalyticsReport(filters.query);
  const [granularityChoice, setGranularity] = useState<Granularity | null>(null);

  const data = report.data;
  const granularity = granularityChoice ?? defaultGranularity(data?.range.days ?? 30);
  const series = data
    ? { day: data.daily, week: data.weekly, month: data.monthly }[granularity]
    : [];
  const noData = data && data.totals.seconds === 0;

  return (
    <>
      <PageHeader title="Analytics" description="When, where and in what you write code." />
      <ActivityFilterBar
        state={filters.state}
        onChange={filters.update}
        onReset={filters.reset}
        activeCount={filters.activeCount}
        ranges={RANGES}
      />

      {report.isError ? (
        <Panel>
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        </Panel>
      ) : (
        <div aria-busy={report.isFetching} className="flex flex-col gap-6">
          <StatStrip loading={!data} stats={summaryStats(data)} />

          {noData ? (
            <Panel>
              <EmptyState
                icon={<BarChart3 />}
                title="No coding time in this range"
                description="Try a longer date range or clear the filters."
              />
            </Panel>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                <Panel className="lg:col-span-2">
                  <PanelHeader
                    title="Coding time"
                    description={`Active time per ${granularity}.`}
                    actions={
                      <SegmentedControl<Granularity>
                        size="sm"
                        label="Group by"
                        value={granularity}
                        onChange={setGranularity}
                        options={[
                          { value: 'day', label: 'Day' },
                          { value: 'week', label: 'Week' },
                          { value: 'month', label: 'Month' },
                        ]}
                      />
                    }
                  />
                  <PanelBody>
                    {data ? (
                      <DailyBarChart
                        data={series}
                        granularity={granularity}
                        tickFormat={series.length > 7 ? 'day' : 'weekday'}
                      />
                    ) : (
                      <Skeleton className="h-60 w-full" />
                    )}
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="By weekday" description="Total across the range." />
                  <PanelBody>
                    {data ? (
                      <WeekdayChart
                        data={data.weekdays}
                        weekStartsOn={user.settings.weekStartsOn}
                      />
                    ) : (
                      <Skeleton className="h-56 w-full" />
                    )}
                  </PanelBody>
                </Panel>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Panel className="lg:col-span-2">
                  <PanelHeader
                    title="By hour of day"
                    description={`When you code, in ${user.timezone.replaceAll('_', ' ')}.`}
                  />
                  <PanelBody>
                    {data ? (
                      <HourlyChart data={data.hourly} />
                    ) : (
                      <Skeleton className="h-56 w-full" />
                    )}
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader
                    title="Session length"
                    description="Time spent in short and long sessions."
                  />
                  <PanelBody>
                    {data ? (
                      <BreakdownList
                        empty="No sessions started in this range."
                        items={data.sessionLengths.map((bucket, index) => ({
                          key: bucket.key,
                          label: `${SHORT_LENGTH_LABELS[bucket.key]}, ${bucket.sessions} ${bucket.sessions === 1 ? 'session' : 'sessions'}`,
                          seconds: bucket.seconds,
                          color: `var(--pulse-${index + 2})`,
                        }))}
                      />
                    ) : (
                      <SkeletonRows rows={3} />
                    )}
                  </PanelBody>
                </Panel>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Panel>
                  <PanelHeader title="Projects" />
                  <PanelBody>
                    {data ? (
                      <BreakdownList
                        empty="No project time in this range."
                        items={foldSeries(data.projects, (item) => ({
                          key: item.id ?? 'none',
                          label: item.label,
                          seconds: item.seconds,
                          color: projectColor(item.color),
                        }))}
                      />
                    ) : (
                      <SkeletonRows rows={4} />
                    )}
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Languages" />
                  <PanelBody>
                    {data ? (
                      <BreakdownList
                        empty="No language data in this range."
                        items={foldSeries(data.languages, (item) => ({
                          key: item.label,
                          label: languageName(item.label),
                          seconds: item.seconds,
                        }))}
                      />
                    ) : (
                      <SkeletonRows rows={4} />
                    )}
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Devices" />
                  <PanelBody>
                    {data ? (
                      <BreakdownList
                        empty="No device data in this range."
                        items={foldSeries(data.devices, (item) => ({
                          key: item.id ?? 'manual',
                          label: item.label,
                          seconds: item.seconds,
                        }))}
                      />
                    ) : (
                      <SkeletonRows rows={3} />
                    )}
                  </PanelBody>
                </Panel>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
