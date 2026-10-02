import { useInfiniteQuery } from '@tanstack/react-query';
import type { CodingSessionDto, TimelineQuery } from '@devpulse/shared';
import { Activity, Plus, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useCurrentUser } from '@/features/auth/auth-context';
import { LogSessionDialog } from '@/features/sessions/components/LogSessionDialog';
import { deviceLabel } from '@/features/sessions/components/session-columns';
import { sessionTitle } from '@/features/sessions/sessions-api';
import { projectColor } from '@/lib/colors';
import { formatDuration, formatTime } from '@/lib/format';
import { languageName } from '@/lib/languages';
import { dayLabel } from '@/lib/timezone';
import { activityApi, activityKeys } from './activity-api';
import { ActivityFilterBar } from './components/ActivityFilterBar';
import { groupByDay } from './group-by-day';
import { useActivityFilters } from './useActivityFilters';

const PAGE_LIMIT = 30;

function TimelineItem({ session, timeZone }: { session: CodingSessionDto; timeZone: string }) {
  const time = formatTime(session.startedAt, timeZone);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-x-4 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
      <time
        dateTime={session.startedAt}
        className="tabular hidden pt-3.5 text-right text-sm text-ink-muted sm:block"
      >
        {time}
      </time>
      <div className="relative border-l border-line pb-3 pl-4 sm:pl-5">
        <span
          aria-hidden
          className="absolute top-[1.15rem] -left-[5px] size-[9px] rounded-full ring-4 ring-surface"
          style={{
            backgroundColor: session.project
              ? projectColor(session.project.color)
              : 'var(--line-strong)',
          }}
        />
        <Link
          to={`/sessions/${session.id}`}
          className="-mx-2 flex items-start justify-between gap-4 rounded-control px-2 py-2.5 transition-colors hover:bg-surface-2 sm:-mx-3 sm:px-3"
        >
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-2 font-medium">
              <span className="truncate">{sessionTitle(session)}</span>
              {session.status === 'ACTIVE' && <Badge tone="success">In progress</Badge>}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
              {/* Below the sm breakpoint the time column is hidden, so the time leads this line. */}
              <time dateTime={session.startedAt} className="tabular sm:hidden">
                {time}
              </time>
              <span aria-hidden className="sm:hidden">
                ·
              </span>
              <span>{session.project?.name ?? 'No project'}</span>
              {session.language && (
                <>
                  <span aria-hidden>·</span>
                  <span>{languageName(session.language)}</span>
                </>
              )}
              <span aria-hidden className="hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline">{deviceLabel(session)}</span>
            </p>
          </div>
          <span className="tabular shrink-0 pt-0.5 font-medium">
            {formatDuration(session.activeSeconds)}
          </span>
        </Link>
      </div>
    </li>
  );
}

function TimelineSkeleton() {
  return (
    <div role="status" aria-label="Loading activity" className="flex flex-col gap-6 p-5">
      {[0, 1].map((group) => (
        <div key={group} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-14 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ActivityPage() {
  const user = useCurrentUser();
  const [logging, setLogging] = useState(false);
  const filters = useActivityFilters('30d');
  const query: TimelineQuery = { ...filters.query, limit: PAGE_LIMIT };

  const timeline = useInfiniteQuery({
    queryKey: activityKeys.timeline(query),
    queryFn: ({ pageParam, signal }) =>
      activityApi.timeline({ ...query, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const sessions = useMemo(
    () => timeline.data?.pages.flatMap((page) => page.data) ?? [],
    [timeline.data],
  );
  const groups = useMemo(() => groupByDay(sessions, user.timezone), [sessions, user.timezone]);
  const filtered = filters.activeCount > 0 || filters.state.range !== 'all';

  return (
    <>
      <PageHeader
        title="Activity"
        description="A timeline of your coding, newest first."
        actions={
          <Button variant="secondary" leadingIcon={<Plus />} onClick={() => setLogging(true)}>
            Log a session
          </Button>
        }
      />
      <ActivityFilterBar
        state={filters.state}
        onChange={filters.update}
        onReset={filters.reset}
        activeCount={filters.activeCount}
        ranges={['today', 'yesterday', '7d', '30d', '90d', 'all']}
      />

      <Panel aria-busy={timeline.isFetching}>
        {timeline.isPending ? (
          <TimelineSkeleton />
        ) : timeline.isError ? (
          <ErrorState error={timeline.error} onRetry={() => void timeline.refetch()} />
        ) : sessions.length === 0 ? (
          filtered ? (
            <EmptyState
              compact
              icon={<SearchX />}
              title="No activity matches these filters"
              description="Try a longer date range or clear the filters."
            />
          ) : (
            <EmptyState
              icon={<Activity />}
              title="No coding activity yet"
              description="Connect your DevPulse VS Code extension to begin tracking your development activity."
              action={<ButtonLink to="/settings/integrations">Connect VS Code</ButtonLink>}
            />
          )
        ) : (
          <div className="flex flex-col gap-7 px-4 py-5 sm:px-5">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`day-${group.key}`}>
                <header className="mb-2 flex items-baseline justify-between gap-3 pl-4 sm:pl-[6.5rem]">
                  <h2 id={`day-${group.key}`} className="font-sans text-sm font-semibold">
                    {dayLabel(group.key, user.timezone)}
                  </h2>
                  <p className="tabular text-xs text-ink-muted">
                    {group.sessions.length} {group.sessions.length === 1 ? 'session' : 'sessions'},{' '}
                    {formatDuration(group.activeSeconds)}
                  </p>
                </header>
                <ol>
                  {group.sessions.map((session) => (
                    <TimelineItem key={session.id} session={session} timeZone={user.timezone} />
                  ))}
                </ol>
              </section>
            ))}
            {timeline.hasNextPage && (
              <div className="flex justify-center">
                <Button
                  variant="secondary"
                  loading={timeline.isFetchingNextPage}
                  onClick={() => void timeline.fetchNextPage()}
                >
                  Load older activity
                </Button>
              </div>
            )}
          </div>
        )}
      </Panel>

      {logging && <LogSessionDialog open onOpenChange={setLogging} />}
    </>
  );
}
