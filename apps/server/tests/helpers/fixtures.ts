import { prisma } from '../../src/database/prisma';

/** Inserts an ended coding session directly (bypassing ingestion) for aggregation tests. */
export async function insertSession(input: {
  userId: string;
  projectId?: string | null;
  deviceId?: string | null;
  startedAt: Date;
  durationSeconds: number;
  activeSeconds?: number;
  language?: string;
}) {
  const activeSeconds = input.activeSeconds ?? input.durationSeconds;
  return prisma.codingSession.create({
    data: {
      userId: input.userId,
      projectId: input.projectId ?? null,
      deviceId: input.deviceId ?? null,
      source: 'MANUAL',
      status: 'ENDED',
      startedAt: input.startedAt,
      endedAt: new Date(input.startedAt.getTime() + input.durationSeconds * 1000),
      durationSeconds: input.durationSeconds,
      activeSeconds,
      idleSeconds: input.durationSeconds - activeSeconds,
      language: input.language ?? 'typescript',
      languages: { create: [{ language: input.language ?? 'typescript', activeSeconds }] },
    },
  });
}
