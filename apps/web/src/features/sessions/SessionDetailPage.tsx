import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActivityEventType, CodingSessionDetailDto } from '@devpulse/shared';
import { ArrowLeft, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { BreakdownList } from '@/components/BreakdownList';
import { StatStrip } from '@/components/StatStrip';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useCurrentUser } from '@/features/auth/auth-context';
import { platformName } from '@/features/devices/devices-api';
import { ApiError, getErrorMessage } from '@/lib/api-client';
import { formatDate, formatDuration, formatPercent, formatRelative } from '@/lib/format';
import { languageName } from '@/lib/languages';
import { foldSeries } from '@/lib/series';
import { EditSessionDialog } from './components/EditSessionDialog';
import { deviceLabel, timeRange } from './components/session-columns';
import { ProjectLabel } from './components/SessionCells';
import { invalidateSessionData, sessionKeys, sessionsApi, sessionTitle } from './sessions-api';

const EVENT_LABELS: Record<ActivityEventType, string> = {
  ACTIVITY: 'Activity heartbeats',
  SESSION_STARTED: 'Session started',
  SESSION_ENDED: 'Session ended',
  FILE_OPENED: 'Files opened',
  FILE_CHANGED: 'File saves',
  IDLE_STARTED: 'Idle periods',
  IDLE_ENDED: 'Returned from idle',
  GIT_COMMIT: 'Commits',
  DEBUG_STARTED: 'Debug sessions started',
  DEBUG_STOPPED: 'Debug sessions stopped',
};

const SOURCE_LABELS: Record<CodingSessionDetailDto['source'], string> = {
  EXTENSION: 'Editor extension',
  MANUAL: 'Logged manually',
  IMPORT: 'Imported',
};

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Active and idle time as one proportional bar, labelled in text. */
function TimeSplit({ session }: { session: CodingSessionDetailDto }) {
  const total = session.durationSeconds;
  const activeShare = total > 0 ? session.activeSeconds / total : 0;
  return (
    <div>
      <div
        role="img"
        aria-label={`${formatPercent(activeShare)} of the session was active coding`}
        className="flex h-3 overflow-hidden rounded-full bg-surface-3"
      >
        <span className="h-full bg-accent" style={{ width: `${activeShare * 100}%` }} />
        <span className="h-full bg-amber-soft" style={{ width: `${(1 - activeShare) * 100}%` }} />
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-full bg-accent" />
          <dt className="text-ink-muted">Active</dt>
          <dd className="tabular font-medium">{formatDuration(session.activeSeconds)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-full bg-amber-soft ring-1 ring-amber/40" />
          <dt className="text-ink-muted">Idle</dt>
          <dd className="tabular font-medium">{formatDuration(session.idleSeconds)}</dd>
        </div>
      </dl>
    </div>
  );
}

function ChangeStats({ session }: { session: CodingSessionDetailDto }) {
  const items = [
    { label: 'Files changed', value: session.filesChanged.toLocaleString() },
    {
      label: 'Lines added',
      value: `+${session.linesAdded.toLocaleString()}`,
      className: 'text-success',
    },
    {
      label: 'Lines removed',
      value: `−${session.linesRemoved.toLocaleString()}`,
      className: 'text-danger',
    },
    { label: 'Commits', value: session.commits.toLocaleString() },
  ];
  return (
    <dl className="grid grid-cols-2 gap-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-sm text-ink-muted">{item.label}</dt>
          <dd
            className={`tabular mt-0.5 font-display text-xl font-semibold ${item.className ?? ''}`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SessionDetailPage() {
  const { sessionId = '' } = useParams();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const session = useQuery({
    queryKey: sessionKeys.detail(sessionId),
    queryFn: ({ signal }) => sessionsApi.get(sessionId, signal),
    // A running session keeps growing; refresh it while the page is open.
    refetchInterval: (query) => (query.state.data?.status === 'ACTIVE' ? 60_000 : false),
  });

  const remove = useMutation({
    mutationFn: () => sessionsApi.remove(sessionId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: sessionKeys.detail(sessionId) });
      invalidateSessionData(queryClient);
      toast.success('Session deleted');
      navigate('/sessions', { replace: true });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const backLink = (
    <Link
      to="/sessions"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Sessions
    </Link>
  );

  if (session.isError) {
    const missing = session.error instanceof ApiError && session.error.status === 404;
    return (
      <>
        {backLink}
        <Panel>
          {missing ? (
            <EmptyState
              title="Session not found"
              description="It may have been deleted, or it belongs to another account."
              action={
                <Link to="/sessions" className="text-accent hover:underline">
                  Back to sessions
                </Link>
              }
            />
          ) : (
            <ErrorState error={session.error} onRetry={() => void session.refetch()} />
          )}
        </Panel>
      </>
    );
  }

  const data = session.data;
  const tz = user.timezone;
  const activeShare =
    data && data.durationSeconds > 0 ? data.activeSeconds / data.durationSeconds : 0;
  const events = data ? [...data.events].sort((a, b) => b.count - a.count) : [];

  return (
    <>
      {backLink}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {data ? (
            <>
              <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold sm:text-[1.75rem]">
                <span className="min-w-0 truncate">{sessionTitle(data)}</span>
                {data.status === 'ACTIVE' && <Badge tone="success">In progress</Badge>}
              </h1>
              <p className="mt-1.5 text-ink-muted">
                {formatDate(data.startedAt, { dateStyle: 'full' }, tz)}, {timeRange(data, tz)}
              </p>
            </>
          ) : (
            <>
              <Skeleton className="h-9 w-72" />
              <Skeleton className="mt-2 h-5 w-56" />
            </>
          )}
        </div>
        {data && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label="Session actions" className="border border-line bg-surface">
                <MoreHorizontal />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil />
                Edit session
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" onSelect={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <StatStrip
        loading={!data}
        className="mb-6"
        stats={[
          { label: 'Duration', value: formatDuration(data?.durationSeconds ?? 0) },
          { label: 'Active coding', value: formatDuration(data?.activeSeconds ?? 0) },
          { label: 'Idle', value: formatDuration(data?.idleSeconds ?? 0) },
          { label: 'Focus', value: formatPercent(activeShare), hint: 'Share of time active' },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel>
            <PanelHeader title="Active and idle time" />
            <PanelBody>
              {data ? <TimeSplit session={data} /> : <Skeleton className="h-12" />}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Languages" description="Active time per language." />
            <PanelBody>
              {data ? (
                <BreakdownList
                  empty="No language breakdown was recorded for this session."
                  items={foldSeries(data.languages, (item) => ({
                    key: item.language,
                    label: languageName(item.language),
                    seconds: item.activeSeconds,
                  }))}
                />
              ) : (
                <SkeletonRows rows={3} />
              )}
            </PanelBody>
          </Panel>

          <div className="grid gap-6 sm:grid-cols-2">
            <Panel>
              <PanelHeader title="Changes" description="Counts only, never file contents." />
              <PanelBody>
                {data ? <ChangeStats session={data} /> : <Skeleton className="h-28" />}
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Editor events" />
              <PanelBody>
                {!data ? (
                  <SkeletonRows rows={3} />
                ) : events.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    {data.source === 'EXTENSION'
                      ? 'No editor events were recorded for this session.'
                      : 'Events are only recorded by the editor extension.'}
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line text-sm">
                    {events.map((event) => (
                      <li key={event.type} className="flex justify-between gap-3 py-2">
                        <span className="text-ink-muted">{EVENT_LABELS[event.type]}</span>
                        <span className="tabular font-medium">{event.count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>
          </div>
        </div>

        <Panel className="self-start">
          <PanelHeader title="Details" />
          <PanelBody className="pt-2">
            {data ? (
              <dl className="divide-y divide-line text-sm">
                <DetailRow label="Project">
                  {data.project ? (
                    <Link to={`/projects/${data.project.id}`} className="hover:underline">
                      <ProjectLabel project={data.project} />
                    </Link>
                  ) : (
                    <ProjectLabel project={null} />
                  )}
                </DetailRow>
                <DetailRow label="Repository">{data.repository ?? 'Not recorded'}</DetailRow>
                <DetailRow label="Branch">
                  {data.branch ? (
                    <code className="font-mono text-xs">{data.branch}</code>
                  ) : (
                    'Not recorded'
                  )}
                </DetailRow>
                <DetailRow label="Device">
                  {data.device ? (
                    <Link to="/devices" className="hover:underline">
                      {data.device.name}
                      {data.device.platform && (
                        <span className="text-ink-muted">
                          {' '}
                          · {platformName(data.device.platform)}
                        </span>
                      )}
                    </Link>
                  ) : (
                    deviceLabel(data)
                  )}
                </DetailRow>
                <DetailRow label="Editor">
                  {data.editor === 'vscode' ? 'VS Code' : (data.editor ?? 'Not recorded')}
                </DetailRow>
                <DetailRow label="Recorded by">{SOURCE_LABELS[data.source]}</DetailRow>
                {data.status === 'ACTIVE' && data.lastHeartbeatAt && (
                  <DetailRow label="Last heartbeat">
                    {formatRelative(data.lastHeartbeatAt)}
                  </DetailRow>
                )}
                <DetailRow label="Recorded">
                  {formatDate(data.createdAt, { dateStyle: 'medium', timeStyle: 'short' }, tz)}
                </DetailRow>
              </dl>
            ) : (
              <SkeletonRows rows={6} />
            )}
          </PanelBody>
        </Panel>
      </div>

      {editing && data && <EditSessionDialog session={data} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this session?"
        description="Its time is removed from your totals, analytics and goals. This cannot be undone."
        confirmLabel="Delete session"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
