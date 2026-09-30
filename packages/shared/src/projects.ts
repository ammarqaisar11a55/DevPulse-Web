import { z } from 'zod';
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
