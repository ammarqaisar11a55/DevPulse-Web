import { z } from 'zod';
import { idSchema, languageSchema, optionalQueryString, paginationQuerySchema } from './common';
import { repositoryUrlSchema } from './projects';

/** Longest session the API accepts; longer spans should be split by the client. */
export const MAX_SESSION_HOURS = 24;
export const MAX_SESSION_SECONDS = MAX_SESSION_HOURS * 3600;
/** Events accepted per ingestion request. */
export const MAX_EVENTS_PER_BATCH = 500;

export const SESSION_SOURCES = ['EXTENSION', 'MANUAL', 'IMPORT'] as const;
export type SessionSource = (typeof SESSION_SOURCES)[number];
export type SessionStatus = 'ACTIVE' | 'ENDED';

export const ACTIVITY_EVENT_TYPES = [
  'ACTIVITY',
  'SESSION_STARTED',
  'SESSION_ENDED',
  'FILE_OPENED',
  'FILE_CHANGED',
  'IDLE_STARTED',
  'IDLE_ENDED',
  'GIT_COMMIT',
  'DEBUG_STARTED',
  'DEBUG_STOPPED',
] as const;
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

const datetime = z.iso
  .datetime({ offset: true, message: 'Use an ISO 8601 timestamp' })
  .transform((value) => new Date(value));
const counter = z.number().int().min(0).max(1_000_000);
const shortText = (max: number) => z.string().trim().min(1).max(max);

/** Per-language active time within a session. */
export const sessionLanguagesSchema = z
  .array(
    z.object({
      language: languageSchema,
      activeSeconds: z.number().int().min(0).max(MAX_SESSION_SECONDS),
    }),
  )
  .max(20);

/**
 * Identifies the project a session belongs to. Clients may reference an existing project by id,
 * or describe the workspace so the server finds or creates the matching project.
 */
export const projectRefSchema = z.object({
  name: shortText(80),
  repositoryUrl: repositoryUrlSchema.optional(),
});

const sessionMetadataFields = {
  title: shortText(120).nullable().optional(),
  language: languageSchema.nullable().optional(),
  languages: sessionLanguagesSchema.optional(),
  repository: shortText(200).nullable().optional(),
  branch: shortText(200).nullable().optional(),
  editor: shortText(40).nullable().optional(),
  filesChanged: counter.optional(),
  linesAdded: counter.optional(),
  linesRemoved: counter.optional(),
  commits: counter.optional(),
};

/**
 * Records a session. With `endedAt` the session is stored as finished (manual logging or a
 * completed upload); without it the session starts as ACTIVE and is updated by heartbeats.
 */
export const createSessionSchema = z
  .object({
    clientSessionId: shortText(64).optional(),
    projectId: idSchema.nullable().optional(),
    project: projectRefSchema.optional(),
    startedAt: datetime,
    endedAt: datetime.optional(),
    /** Defaults to the full duration for finished sessions. */
    activeSeconds: z.number().int().min(0).max(MAX_SESSION_SECONDS).optional(),
    ...sessionMetadataFields,
  })
  .refine((data) => !(data.projectId && data.project), {
    message: 'Provide either projectId or project, not both',
    path: ['project'],
  });
export type CreateSessionInput = z.input<typeof createSessionSchema>;

/** Heartbeat or completion update. Counters are cumulative totals for the session. */
export const updateSessionSchema = z.object({
  projectId: idSchema.nullable().optional(),
  lastHeartbeatAt: datetime.optional(),
  endedAt: datetime.optional(),
  activeSeconds: z.number().int().min(0).max(MAX_SESSION_SECONDS).optional(),
  ...sessionMetadataFields,
});
export type UpdateSessionInput = z.input<typeof updateSessionSchema>;

/** Filters shared by session lists, the activity timeline and analytics. */
export const activityFiltersSchema = z.object({
  from: datetime.optional(),
  to: datetime.optional(),
  projectId: z.union([idSchema, z.literal('none')]).optional(),
  deviceId: idSchema.optional(),
  language: optionalQueryString(40).transform((value) => value?.toLowerCase()),
  repository: optionalQueryString(200),
});

/** Query parameters as a client sends them: timestamps travel as ISO 8601 strings. */
type ClientQuery<T> = Partial<Omit<T, 'from' | 'to'>> & { from?: string; to?: string };

export const listSessionsQuerySchema = paginationQuerySchema.extend({
  ...activityFiltersSchema.shape,
  source: z.enum(SESSION_SOURCES).optional(),
  sort: z.enum(['recent', 'oldest', 'longest']).default('recent'),
});
export type ListSessionsQuery = ClientQuery<z.output<typeof listSessionsQuerySchema>>;

export const timelineQuerySchema = activityFiltersSchema.extend({
  cursor: optionalQueryString(200),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type TimelineQuery = ClientQuery<z.output<typeof timelineQuerySchema>>;

/**
 * Event metadata is an allow-list of small, non-content fields. Unknown keys are rejected so
 * source code or file contents can never be stored by accident.
 */
export const eventMetadataSchema = z
  .object({
    fileExtension: z
      .string()
      .max(16)
      .regex(/^\.?[\w.+-]*$/),
    linesAdded: counter,
    linesRemoved: counter,
    commitCount: counter,
    idleSeconds: counter,
    debugType: z.string().max(40),
    reason: z.string().max(80),
  })
  .partial()
  .strict();

export const activityEventSchema = z.object({
  clientEventId: shortText(64).optional(),
  type: z.enum(ACTIVITY_EVENT_TYPES),
  occurredAt: datetime,
  sessionId: idSchema.optional(),
  projectId: idSchema.optional(),
  language: languageSchema.optional(),
  metadata: eventMetadataSchema.optional(),
});

export const ingestEventsSchema = z.object({
  events: z.array(activityEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});
export type IngestEventsInput = z.input<typeof ingestEventsSchema>;

export interface SessionProjectRef {
  id: string;
  name: string;
  color: string;
}

export interface SessionDeviceRef {
  id: string;
  name: string;
  platform: string | null;
}

export interface CodingSessionDto {
  id: string;
  source: SessionSource;
  status: SessionStatus;
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  lastHeartbeatAt: string | null;
  durationSeconds: number;
  activeSeconds: number;
  idleSeconds: number;
  language: string | null;
  repository: string | null;
  branch: string | null;
  editor: string | null;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  commits: number;
  project: SessionProjectRef | null;
  device: SessionDeviceRef | null;
  createdAt: string;
}

export interface CodingSessionDetailDto extends CodingSessionDto {
  languages: { language: string; activeSeconds: number }[];
  events: { type: ActivityEventType; count: number }[];
}

export interface TimelineResponse {
  data: CodingSessionDto[];
  nextCursor: string | null;
}

export interface ActivityFilterOptions {
  projects: SessionProjectRef[];
  devices: SessionDeviceRef[];
  languages: string[];
  repositories: string[];
}

export interface IngestEventsResult {
  accepted: number;
  duplicates: number;
}
