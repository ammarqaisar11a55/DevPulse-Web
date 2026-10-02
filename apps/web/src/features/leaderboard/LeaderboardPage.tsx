import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LeaderboardDto, LeaderboardEntry, LeaderboardPeriod } from '@devpulse/shared';
import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { ShareBar } from '@/components/ShareBar';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Switch } from '@/components/ui/Switch';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useUpdateSettings } from '@/features/settings/useUpdateSettings';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';
import { FieldStrip } from './components/FieldStrip';
import { leaderboardApi, leaderboardKey } from './leaderboard-api';
import { PERIOD_NOUN, standingSentence } from './standing';

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
};

/** Rank, person, time and gap to the leader: the columns of a timing sheet. */
const ROW_GRID =
  'grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-4 sm:grid-cols-[3rem_minmax(0,1fr)_6.5rem_7.5rem]';

function StandingPanel({
  data,
  period,
}: {
  data: LeaderboardDto | undefined;
  period: LeaderboardPeriod;
}) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const update = useUpdateSettings();
  const optedIn = update.variables?.showOnLeaderboard ?? user.settings.showOnLeaderboard;

  return (
    <Panel className="mb-6 overflow-hidden">
      <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        {data ? (
          <p className="max-w-2xl font-display text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl">
            {standingSentence(data, period)}
          </p>
        ) : (
          <Skeleton className="h-8 w-full max-w-md" />
        )}
        <div className="mt-5">
          {data && data.entries.length > 0 ? (
            <FieldStrip
              markers={data.entries.map((entry) => ({
                key: entry.username,
                seconds: entry.seconds,
                isCurrentUser: entry.isCurrentUser,
              }))}
              mySeconds={data.me.seconds}
              showMe={data.me.optedIn && data.me.rank !== null}
            />
          ) : data ? (
            <p className="text-sm text-ink-muted">
              Your coding time {PERIOD_NOUN[period]}: {formatDuration(data.me.seconds)}.
            </p>
          ) : (
            <Skeleton className="h-20 w-full" />
          )}
        </div>
      </div>
      <div className="border-t border-line bg-surface-2 px-5 py-4 sm:px-6">
        <Switch
          checked={optedIn}
          disabled={update.isPending}
          onCheckedChange={(checked) =>
            update.mutate(
              { showOnLeaderboard: checked },
              {
                onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
              },
            )
          }
          label="Show me on the leaderboard"
          description="Others see your name, username, avatar and total coding time. Projects, repositories and languages are never shared."
        />
      </div>
    </Panel>
  );
}

function RankRow({ entry, leaderSeconds }: { entry: LeaderboardEntry; leaderSeconds: number }) {
  const gap = leaderSeconds - entry.seconds;
  const gapLabel = entry.rank === 1 ? 'Leading' : formatDuration(gap);
  return (
    <li
      aria-current={entry.isCurrentUser ? 'true' : undefined}
      className={cn(
        ROW_GRID,
        'relative px-4 py-3.5 sm:px-5',
        entry.isCurrentUser &&
          'bg-accent-soft/60 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent',
      )}
    >
      <span
        className={cn(
          'tabular text-center font-display leading-none font-semibold',
          entry.rank === 1 ? 'text-3xl' : entry.rank <= 3 ? 'text-2xl' : 'text-lg text-ink-subtle',
        )}
      >
        {entry.rank}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={entry.fullName} src={entry.avatarUrl} />
          <p className="min-w-0 truncate">
            <span className="font-medium">{entry.fullName}</span>
            {entry.isCurrentUser && <span className="ml-2 text-sm text-accent-ink">You</span>}
            <span className="ml-2 hidden text-sm text-ink-muted sm:inline">@{entry.username}</span>
          </p>
        </div>
        <ShareBar
          className="mt-2.5"
          ratio={leaderSeconds > 0 ? entry.seconds / leaderSeconds : 0}
          color={entry.isCurrentUser ? 'var(--accent)' : 'var(--pulse-2)'}
        />
      </div>
      <div className="text-right">
        <p className="tabular font-display text-lg font-semibold">
          {formatDuration(entry.seconds)}
        </p>
        <p className="tabular text-xs text-ink-muted sm:hidden">
          {entry.rank === 1 ? 'Leading' : `${gapLabel} behind`}
        </p>
      </div>
      <p className="tabular hidden text-right text-sm text-ink-muted sm:block">{gapLabel}</p>
    </li>
  );
}

function TowerHeader() {
  return (
    <div
      aria-hidden
      className={cn(
        ROW_GRID,
        'border-b border-line px-4 py-2.5 text-xs font-medium text-ink-muted sm:px-5',
      )}
    >
      <span className="text-center">Rank</span>
      <span>Developer</span>
      <span className="text-right">Coding time</span>
      <span className="hidden text-right sm:block">Behind leader</span>
    </div>
  );
}

export function LeaderboardPage() {
  const user = useCurrentUser();
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const board = useQuery({
    queryKey: leaderboardKey(period),
    queryFn: ({ signal }) => leaderboardApi.get(period, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 5 * 60_000,
  });
  const data = board.data;
  const leaderSeconds = data?.entries[0]?.seconds ?? 0;
  // Ranked below the visible list: pin the user's own row after it.
  const pinnedMe: LeaderboardEntry | null =
    data?.me.rank && !data.entries.some((entry) => entry.isCurrentUser)
      ? {
          rank: data.me.rank,
          username: user.username,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          seconds: data.me.seconds,
          isCurrentUser: true,
        }
      : null;

  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Active coding time among developers who chose to be listed. Days, weeks and months are counted in UTC so everyone races over the same window."
        actions={
          <SegmentedControl<LeaderboardPeriod>
            label="Leaderboard period"
            value={period}
            onChange={setPeriod}
            options={(['day', 'week', 'month'] as const).map((value) => ({
              value,
              label: PERIOD_LABELS[value],
            }))}
          />
        }
      />

      <StandingPanel data={data} period={period} />

      <Panel aria-busy={board.isFetching} className="overflow-hidden">
        {board.isPending ? (
          <SkeletonRows rows={6} className="p-5" />
        ) : board.isError ? (
          <ErrorState error={board.error} onRetry={() => void board.refetch()} />
        ) : board.data.entries.length === 0 ? (
          <EmptyState
            icon={<Trophy />}
            title={`Nobody is ranked ${PERIOD_NOUN[period]} yet`}
            description="Developers appear here once they turn on their listing and record at least a minute of coding in the period."
          />
        ) : (
          <>
            <TowerHeader />
            <ol aria-label={`Leaderboard, ${PERIOD_NOUN[period]}`} className="divide-y divide-line">
              {board.data.entries.map((entry) => (
                <RankRow key={entry.username} entry={entry} leaderSeconds={leaderSeconds} />
              ))}
            </ol>
            {pinnedMe && (
              <ol
                aria-label="Your position"
                className="border-t-2 border-dashed border-line"
                start={pinnedMe.rank}
              >
                <RankRow entry={pinnedMe} leaderSeconds={leaderSeconds} />
              </ol>
            )}
          </>
        )}
      </Panel>
    </>
  );
}
