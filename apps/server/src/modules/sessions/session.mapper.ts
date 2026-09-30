import type { CodingSessionDto } from '@devpulse/shared';
import type { CodingSession, Prisma } from '@prisma/client';

export const sessionInclude = {
  project: { select: { id: true, name: true, color: true } },
  device: { select: { id: true, name: true, platform: true } },
} satisfies Prisma.CodingSessionInclude;

export type SessionWithRefs = CodingSession & {
  project: { id: string; name: string; color: string | null } | null;
  device: { id: string; name: string; platform: string | null } | null;
};

export function toSessionDto(session: SessionWithRefs): CodingSessionDto {
  return {
    id: session.id,
    source: session.source,
    status: session.status,
    title: session.title,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    lastHeartbeatAt: session.lastHeartbeatAt?.toISOString() ?? null,
    durationSeconds: session.durationSeconds,
    activeSeconds: session.activeSeconds,
    idleSeconds: session.idleSeconds,
    language: session.language,
    repository: session.repository,
    branch: session.branch,
    editor: session.editor,
    filesChanged: session.filesChanged,
    linesAdded: session.linesAdded,
    linesRemoved: session.linesRemoved,
    commits: session.commits,
    project: session.project
      ? { ...session.project, color: session.project.color ?? 'blue' }
      : null,
    device: session.device,
    createdAt: session.createdAt.toISOString(),
  };
}
