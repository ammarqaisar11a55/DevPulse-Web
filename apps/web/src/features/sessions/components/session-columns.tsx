import type { CodingSessionDto } from '@devpulse/shared';
import { Badge } from '@/components/ui/Badge';
import type { Column } from '@/components/ui/DataTable';
import { formatDate, formatDuration, formatTime } from '@/lib/format';
import { languageName } from '@/lib/languages';
import { sessionTitle } from '../sessions-api';
import { ActiveTime, ProjectLabel } from './SessionCells';

/** Where a session was recorded: the device name, or how it was entered. */
export function deviceLabel(session: Pick<CodingSessionDto, 'device' | 'source'>) {
  if (session.device) return session.device.name;
  if (session.source === 'MANUAL') return 'Logged manually';
  if (session.source === 'IMPORT') return 'Imported';
  return 'Unknown device';
}

/** "09:16 – 10:37", or "09:16 – now" while the session is still running. */
export function timeRange(
  session: Pick<CodingSessionDto, 'startedAt' | 'endedAt' | 'status'>,
  timeZone: string,
) {
  const start = formatTime(session.startedAt, timeZone);
  if (session.status === 'ACTIVE' || !session.endedAt) return `${start} – now`;
  return `${start} – ${formatTime(session.endedAt, timeZone)}`;
}

export function sessionColumns(timeZone: string): Column<CodingSessionDto>[] {
  return [
    {
      key: 'session',
      header: 'Session',
      mobile: 'primary',
      className: 'max-w-72',
      cell: (session) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <span className="truncate">{sessionTitle(session)}</span>
            {session.status === 'ACTIVE' && <Badge tone="success">In progress</Badge>}
          </span>
          <span className="flex min-w-0 items-center gap-3 text-sm font-normal text-ink-muted">
            <ProjectLabel project={session.project} />
            {session.language && <span className="shrink-0">{languageName(session.language)}</span>}
          </span>
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      className: 'whitespace-nowrap',
      cell: (session) => formatDate(session.startedAt, { dateStyle: 'medium' }, timeZone),
    },
    {
      key: 'time',
      header: 'Time',
      className: 'whitespace-nowrap text-ink-muted',
      cell: (session) => timeRange(session, timeZone),
    },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (session) => formatDuration(session.durationSeconds),
    },
    {
      key: 'active',
      header: 'Active time',
      className: 'whitespace-nowrap',
      cell: (session) => <ActiveTime session={session} />,
    },
    {
      key: 'device',
      header: 'Device',
      // Lowest priority on the desktop table; the stacked mobile list always shows it.
      className: 'max-w-40 truncate text-ink-muted md:hidden xl:table-cell',
      cell: (session) => deviceLabel(session),
    },
  ];
}
