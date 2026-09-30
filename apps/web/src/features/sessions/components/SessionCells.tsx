import type { CodingSessionDto } from '@devpulse/shared';
import { ColorDot } from '@/components/ui/Badge';
import { projectColor } from '@/lib/colors';
import { formatDuration } from '@/lib/format';
import type { ProjectColor } from '@devpulse/shared';

export function ProjectLabel({ project }: { project: CodingSessionDto['project'] }) {
  if (!project) return <span className="text-ink-subtle">No project</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <ColorDot color={projectColor(project.color as ProjectColor)} />
      <span className="truncate">{project.name}</span>
    </span>
  );
}

/** Active time with a small bar showing the active share of the session. */
export function ActiveTime({
  session,
}: {
  session: Pick<CodingSessionDto, 'activeSeconds' | 'durationSeconds'>;
}) {
  const ratio = session.durationSeconds > 0 ? session.activeSeconds / session.durationSeconds : 0;
  return (
    <span className="inline-flex items-center gap-2">
      <span>{formatDuration(session.activeSeconds)}</span>
      <span
        aria-hidden
        className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-amber-soft lg:inline-block"
      >
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </span>
    </span>
  );
}
