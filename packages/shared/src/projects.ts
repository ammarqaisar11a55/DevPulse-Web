import { z } from 'zod';
import type { SeriesPoint, SessionLengthBucket } from './analytics';
import { languageSchema, optionalQueryString, paginationQuerySchema } from './common';

/** Keys map to the chart palette slots 1–6, in order. */
export const PROJECT_COLORS = ['blue', 'teal', 'violet', 'amber', 'magenta', 'orange'] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

export const REPOSITORY_PROVIDERS = [
  'GITHUB',
  'GITLAB',
  'BITBUCKET',
  'AZURE_DEVOPS',
  'OTHER',
] as const;
export type RepositoryProvider = (typeof REPOSITORY_PROVIDERS)[number];

/** Infers the hosting provider from a repository URL. */
export function detectRepositoryProvider(url: string): RepositoryProvider {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (host === 'github.com' || host.endsWith('.github.com')) return 'GITHUB';
  if (host === 'gitlab.com' || host.startsWith('gitlab.')) return 'GITLAB';
  if (host === 'bitbucket.org') return 'BITBUCKET';
  if (host === 'dev.azure.com' || host.endsWith('.visualstudio.com')) return 'AZURE_DEVOPS';
  return 'OTHER';
}

const nullableText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === '' ? null : value))
    .nullable();

export const repositoryUrlSchema = z
  .string()
  .trim()
  .max(500, 'URL is too long')
  .refine(
    (value) => value === '' || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value),
    'Enter a valid http(s) URL',
  )
  .transform((value) => (value === '' ? null : value.replace(/\.git$/, '').replace(/\/$/, '')))
  .nullable();

const projectFields = {
  name: z
    .string()
    .trim()
    .min(1, 'Enter a project name')
    .max(80, 'Name must be at most 80 characters'),
  description: nullableText(500, 'Description must be at most 500 characters'),
  repositoryUrl: repositoryUrlSchema,
  primaryLanguage: z.union([languageSchema, z.literal('').transform(() => null), z.null()]),
  color: z.enum(PROJECT_COLORS),
};

export const createProjectSchema = z.object({
  name: projectFields.name,
  description: projectFields.description.optional(),
  repositoryUrl: projectFields.repositoryUrl.optional(),
  primaryLanguage: projectFields.primaryLanguage.optional(),
  /** Omit (or send null) to have a distinct palette colour chosen automatically. */
  color: projectFields.color.nullish(),
});
export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const updateProjectSchema = z.object({ ...projectFields, archived: z.boolean() }).partial();
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;

export const PROJECT_SORTS = ['recent', 'name', 'time', 'created'] as const;

export const listProjectsQuerySchema = paginationQuerySchema.extend({
  search: optionalQueryString(80),
  language: optionalQueryString(40),
  status: z.enum(['active', 'archived', 'all']).default('active'),
  sort: z.enum(PROJECT_SORTS).default('recent'),
});
/** Client-side query parameters (all optional; the server applies defaults). */
export type ListProjectsQuery = Partial<z.output<typeof listProjectsQuerySchema>>;

export interface ProjectDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  repositoryUrl: string | null;
  repositoryProvider: RepositoryProvider | null;
  primaryLanguage: string | null;
  color: ProjectColor;
  createdAt: string;
  lastActivityAt: string | null;
  archivedAt: string | null;
  /** Active coding seconds across all sessions. */
  totalSeconds: number;
  sessionCount: number;
}

export interface ProjectDetailDto extends ProjectDto {
  /** Active coding seconds since the start of the current week (user's time zone). */
  weekSeconds: number;
  languages: { language: string; seconds: number }[];
  devices: { id: string; name: string; seconds: number }[];
}

/** Days of zero-filled daily history returned with a project's all-time history. */
export const PROJECT_HISTORY_RECENT_DAYS = 90;

/**
 * A project's complete coding record, from the day the account was created (or the first
 * recorded session, if earlier) to today, in the user's time zone. Unlike analytics reports it
 * has no maximum range.
 */
export interface ProjectHistoryDto {
  timezone: string;
  /** First day covered, YYYY-MM-DD. */
  sinceDate: string;
  /** Today, YYYY-MM-DD. */
  toDate: string;
  /** Calendar days from sinceDate to toDate inclusive. */
  days: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  totals: {
    seconds: number;
    sessions: number;
    /** Days with any coding on this project. */
    activeDays: number;
    /** Mean active time per day that had coding. */
    averageActiveDaySeconds: number;
    averageSessionSeconds: number;
    longestDay: { date: string; seconds: number } | null;
  };
  /** Zero-filled, the most recent PROJECT_HISTORY_RECENT_DAYS days (or fewer, from sinceDate). */
  daily: SeriesPoint[];
  /** Zero-filled, every week from sinceDate. Dates are the first day of the week. */
  weekly: SeriesPoint[];
  /** Zero-filled, every month from sinceDate. Dates are the first day of the month. */
  monthly: SeriesPoint[];
  /** 24 entries, local hour 0–23, across all time. */
  hourly: { hour: number; seconds: number }[];
  /** 7 entries, 0 = Sunday, across all time. */
  weekdays: { weekday: number; seconds: number }[];
  sessionLengths: SessionLengthBucket[];
}
