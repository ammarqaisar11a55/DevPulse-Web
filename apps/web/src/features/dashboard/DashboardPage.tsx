import { useQuery } from '@tanstack/react-query';
import type { OverviewDto } from '@devpulse/shared';
import { Laptop, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { BreakdownList } from '@/components/BreakdownList';
import { DailyBarChart } from '@/components/charts/DailyBarChart';
import { PageHeader } from '@/components/PageHeader';
import { StatStrip } from '@/components/StatStrip';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useCurrentUser } from '@/features/auth/auth-context';
import { LogSessionDialog } from '@/features/sessions/components/LogSessionDialog';
import { ProjectLabel } from '@/features/sessions/components/SessionCells';
import { sessionTitle } from '@/features/sessions/sessions-api';
import { projectColor } from '@/lib/colors';
import { formatDuration, formatRelative, percentChange } from '@/lib/format';
import { languageName } from '@/lib/languages';
import { foldSeries } from '@/lib/series';
import { TodayPulse } from './components/TodayPulse';
import { dashboardApi, overviewKey } from './dashboard-api';
import { greeting } from './greeting';

function metrics(data: OverviewDto | undefined) {
  return [
    {
      label: 'This week',
      value: formatDuration(data?.week.seconds ?? 0),
      change: data ? percentChange(data.week.seconds, data.week.previousSeconds) : null,
      changeLabel: 'vs last week so far',
      hint: 'First week of tracking',
    },
    {
      label: 'Sessions this week',
      value: String(data?.sessions.count ?? 0),
      change: data ? percentChange(data.sessions.count, data.sessions.previousCount) : null,
      changeLabel: 'vs last week so far',
    },
    {
      label: 'Projects this week',
      value: String(data?.projects.active ?? 0),
      hint: data
        ? `of ${data.projects.total} active ${data.projects.total === 1 ? 'project' : 'projects'}`
        : undefined,
    },
    {
      label: 'Streak',
      value: `${data?.streakDays ?? 0} ${data?.streakDays === 1 ? 'day' : 'days'}`,
      hint: 'Consecutive days with coding',
    },
  ];
}

function NoActivityYet({ onLog }: { onLog: () => void }) {
  return (
    <Panel>
      <EmptyState
        icon={<Laptop />}
        title="No coding activity yet"
        description="Connect the DevPulse VS Code extension to begin tracking your development activity automatically, or log a session by hand."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink to="/devices">Connect VS Code</ButtonLink>
            <Button variant="secondary" leadingIcon={<Plus />} onClick={onLog}>
              Log a session
            </Button>
          </div>
        }
      />
    </Panel>
  );
}

export function DashboardPage() {
  const user = useCurrentUser();
  const [logging, setLogging] = useState(false);
  const overview = useQuery({
    queryKey: overviewKey,
    queryFn: ({ signal }) => dashboardApi.overview(signal),
    refetchInterval: 5 * 60_000,
  });

  const firstName = user.fullName.split(' ')[0] ?? user.fullName;
  const data = overview.data;
  const tz = user.timezone;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Here's your development activity."
        actions={
          <Button variant="secondary" leadingIcon={<Plus />} onClick={() => setLogging(true)}>
            Log a session
          </Button>
        }
      />

      {overview.isError ? (
        <Panel>
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        </Panel>
      ) : data && !data.hasAnyActivity ? (
        <NoActivityYet onLog={() => setLogging(true)} />
      ) : (
        <>
          <TodayPulse blocks={data?.todayBlocks} todaySeconds={data?.today.seconds} timeZone={tz} />
          <StatStrip loading={!data} stats={metrics(data)} className="mb-6" />

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <PanelHeader title="Last 7 days" description="Active coding time per day." />
              <PanelBody>
                {data ? (
                  <DailyBarChart data={data.last7Days} />
                ) : (
                  <Skeleton className="h-60 w-full" />
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader title="Languages" description="This week." />
              <PanelBody>
                {data ? (
                  <BreakdownList
                    empty="No coding time recorded this week yet."
                    items={foldSeries(data.topLanguages, (item) => ({
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
              <PanelHeader
                title="Projects"
                description="This week."
                actions={
                  <Link to="/projects" className="text-sm text-accent hover:underline">
                    All projects
                  </Link>
                }
              />
              <PanelBody>
                {data ? (
                  <BreakdownList
                    empty="No project time recorded this week yet."
                    items={foldSeries(data.topProjects, (item) => ({
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

            <Panel className="lg:col-span-2">
              <PanelHeader title="Recent sessions" />
              <PanelBody className="pt-3">
                {!data ? (
                  <SkeletonRows rows={4} />
                ) : data.recentSessions.length === 0 ? (
                  <p className="text-sm text-ink-muted">No sessions yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.recentSessions.map((session) => (
                      <li key={session.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{sessionTitle(session)}</p>
                          <p className="mt-0.5 flex min-w-0 items-center gap-3 text-sm text-ink-muted">
                            <ProjectLabel project={session.project} />
                            {session.language && (
                              <span className="shrink-0">{languageName(session.language)}</span>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular font-medium">
                            {formatDuration(session.activeSeconds)}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {formatRelative(session.startedAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>
          </div>
        </>
      )}

      {logging && <LogSessionDialog open onOpenChange={setLogging} />}
    </>
  );
}
