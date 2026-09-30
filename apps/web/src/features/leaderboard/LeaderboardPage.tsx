import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LeaderboardDto, LeaderboardEntry, LeaderboardPeriod } from '@devpulse/shared';
import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { ShareBar } from '@/components/ShareBar';
import { Panel, PanelBody } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Switch } from '@/components/ui/Switch';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useUpdateSettings } from '@/features/settings/useUpdateSettings';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';
import { leaderboardApi, leaderboardKey } from './leaderboard-api';

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
};
const PERIOD_NOUN: Record<LeaderboardPeriod, string> = {
  day: 'today',
  week: 'this week',
  month: 'this month',
};

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

  const standing = !data
    ? 'Loading your standing'
    : !data.me.optedIn
      ? 'You are not listed'
      : data.me.rank
        ? `Rank ${data.me.rank} of ${data.participants}`
        : 'Not ranked yet';

  return (
    <Panel className="mb-6">
      <PanelBody className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
        <div>
          <p className="text-sm text-ink-muted">Your coding time {PERIOD_NOUN[period]}</p>
          <p className="tabular mt-1 font-display text-4xl leading-none font-semibold tracking-tight">
            {formatDuration(data?.me.seconds ?? 0)}
          </p>
          <p className="mt-2 text-sm font-medium">{standing}</p>
        </div>
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
          description="Other DevPulse users will see your name, username, avatar and total coding time. Projects, repositories and languages are never shared."
        />
      </PanelBody>
    </Panel>
  );
}

function RankRow({ entry, leaderSeconds }: { entry: LeaderboardEntry; leaderSeconds: number }) {
  return (
    <li
      aria-current={entry.isCurrentUser ? 'true' : undefined}
      className={cn(
        'grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5',
        entry.isCurrentUser && 'bg-accent-soft/60',
      )}
    >
      <span
        className={cn(
          'tabular text-center font-display text-lg font-semibold',
          entry.rank <= 3 ? 'text-ink' : 'text-ink-subtle',
        )}
      >
        {entry.rank}
      </span>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={entry.fullName} src={entry.avatarUrl} />
        <div className="min-w-0">
          <p className="truncate font-medium">
            {entry.fullName}
            {entry.isCurrentUser && (
              <span className="ml-2 text-sm font-normal text-accent-ink">You</span>
            )}
          </p>
          <p className="truncate text-sm text-ink-muted">@{entry.username}</p>
        </div>
      </div>
      <span className="tabular text-right font-medium">{formatDuration(entry.seconds)}</span>
      <ShareBar
        className="col-span-2 col-start-2"
        ratio={leaderSeconds > 0 ? entry.seconds / leaderSeconds : 0}
        color={entry.isCurrentUser ? 'var(--accent)' : 'var(--pulse-2)'}
      />
    </li>
  );
}

export function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const board = useQuery({
    queryKey: leaderboardKey(period),
    queryFn: ({ signal }) => leaderboardApi.get(period, signal),
    refetchInterval: 5 * 60_000,
  });
  const leaderSeconds = board.data?.entries[0]?.seconds ?? 0;

  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Most active coding time among developers who chose to be listed. Periods reset at midnight UTC."
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

      <StandingPanel data={board.data} period={period} />

      <Panel aria-busy={board.isFetching}>
        {board.isPending ? (
          <SkeletonRows rows={6} className="p-5" />
        ) : board.isError ? (
          <ErrorState error={board.error} onRetry={() => void board.refetch()} />
        ) : board.data.entries.length === 0 ? (
          <EmptyState
            icon={<Trophy />}
            title={`Nobody is ranked ${PERIOD_NOUN[period]} yet`}
            description="Developers appear here once they opt in and record at least a minute of coding in the period."
          />
        ) : (
          <ol aria-label={`Leaderboard, ${PERIOD_NOUN[period]}`} className="divide-y divide-line">
            {board.data.entries.map((entry) => (
              <RankRow key={entry.username} entry={entry} leaderSeconds={leaderSeconds} />
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
