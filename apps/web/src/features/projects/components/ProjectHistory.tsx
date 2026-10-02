import { useQuery } from '@tanstack/react-query';
import {
  PROJECT_HISTORY_RECENT_DAYS,
  type Granularity,
  type ProjectHistoryDto,
} from '@devpulse/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { BreakdownList } from '@/components/BreakdownList';
import { DailyBarChart } from '@/components/charts/DailyBarChart';
import { HourlyChart } from '@/components/charts/HourlyChart';
import { WeekdayChart } from '@/components/charts/WeekdayChart';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useCurrentUser } from '@/features/auth/auth-context';
import { formatDate, formatDuration } from '@/lib/format';
import { projectKeys, projectsApi } from '../projects-api';

const SESSION_LENGTHS = {
  short: { label: 'Under 30 min', color: 'var(--pulse-2)' },
  medium: { label: '30 to 90 min', color: 'var(--pulse-3)' },
  long: { label: 'Over 90 min', color: 'var(--pulse-4)' },
} as const;

/** Formats a local calendar date (YYYY-MM-DD) without shifting it through a time zone. */
const formatDay = (date: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }) =>
  formatDate(`${date}T12:00:00Z`, options, 'UTC');

/** The finest grouping that keeps the bar count readable for the history's length. */
function defaultGranularity(days: number): Granularity {
  if (days > 26 * 7) return 'month';
  if (days > PROJECT_HISTORY_RECENT_DAYS / 2) return 'week';
  return 'day';
}

function HistorySummary({ history }: { history: ProjectHistoryDto }) {
  const { totals } = history;
  const items = [
    { label: 'Days with coding', value: `${totals.activeDays} of ${history.days}` },
    { label: 'Per coding day', value: formatDuration(totals.averageActiveDaySeconds) },
    { label: 'Average session', value: formatDuration(totals.averageSessionSeconds) },
    {
      label: 'Best day',
      value: totals.longestDay
        ? `${formatDuration(totals.longestDay.seconds)}, ${formatDay(totals.longestDay.date, { month: 'short', day: 'numeric', year: 'numeric' })}`
        : 'None yet',
    },
  ];
  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-sm sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-ink-muted">{item.label}</dt>
          <dd className="tabular mt-0.5 truncate font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The project's complete coding record since the account was created: a time series that can be
 * viewed by day, week or month, plus all-time patterns by hour, weekday and session length.
 */
export function ProjectHistory({ projectId }: { projectId: string }) {
  const user = useCurrentUser();
  const [choice, setChoice] = useState<Granularity | null>(null);
  const history = useQuery({
    queryKey: projectKeys.history(projectId),
    queryFn: ({ signal }) => projectsApi.history(projectId, signal),
  });

  if (history.isError) {
    return (
      <Panel className="mb-6">
        <ErrorState
          title="The coding history could not be loaded"
          error={history.error}
          onRetry={() => void history.refetch()}
        />
      </Panel>
    );
  }

  const data = history.data;
  const granularity = choice ?? defaultGranularity(data?.days ?? 0);
  const series = data
    ? { day: data.daily, week: data.weekly, month: data.monthly }[granularity]
    : [];
  const since = data ? formatDay(data.sinceDate) : null;
  const description = !data
    ? 'Loading…'
    : granularity === 'day' && data.days > PROJECT_HISTORY_RECENT_DAYS
      ? `Active time per day, last ${PROJECT_HISTORY_RECENT_DAYS} days.`
      : `Active time per ${granularity} since ${since}.`;

  return (
    <div className="mb-6 flex flex-col gap-6">
      <Panel>
        <PanelHeader
          title="Coding history"
          description={description}
          actions={
            <SegmentedControl<Granularity>
              size="sm"
              label="Group by"
              value={granularity}
              onChange={setChoice}
              options={[
                { value: 'day', label: 'Days' },
                { value: 'week', label: 'Weeks' },
                { value: 'month', label: 'Months' },
              ]}
            />
          }
        />
        <PanelBody>
          {data ? (
            <>
              <DailyBarChart data={series} granularity={granularity} tickFormat="day" />
              <HistorySummary history={data} />
              <p className="mt-4 text-xs text-ink-muted">
                Includes every session recorded since {since}, from the day your account was created
                or your earliest session, whichever came first.{' '}
                <Link
                  to={`/sessions?projectId=${projectId}`}
                  className="text-accent hover:underline"
                >
                  View all sessions
                </Link>
              </p>
            </>
          ) : (
            <>
              <Skeleton className="h-60 w-full" />
              <Skeleton className="mt-5 h-12 w-full" />
            </>
          )}
        </PanelBody>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="By hour of day"
            description={`All time, in ${user.timezone.replaceAll('_', ' ')}.`}
          />
          <PanelBody>
            {data ? <HourlyChart data={data.hourly} /> : <Skeleton className="h-56 w-full" />}
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="By weekday" description="All time." />
          <PanelBody>
            {data ? (
              <WeekdayChart data={data.weekdays} weekStartsOn={user.settings.weekStartsOn} />
            ) : (
              <Skeleton className="h-56 w-full" />
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Session length" description="Time spent in short and long sessions." />
        <PanelBody>
          {data ? (
            <BreakdownList
              empty="No sessions recorded for this project yet."
              items={data.sessionLengths
                .filter((bucket) => bucket.sessions > 0)
                .map((bucket) => ({
                  key: bucket.key,
                  label: `${SESSION_LENGTHS[bucket.key].label}, ${bucket.sessions} ${bucket.sessions === 1 ? 'session' : 'sessions'}`,
                  seconds: bucket.seconds,
                  color: SESSION_LENGTHS[bucket.key].color,
                }))}
            />
          ) : (
            <SkeletonRows rows={3} />
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
