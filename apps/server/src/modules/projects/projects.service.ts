import {
  detectRepositoryProvider,
  PROJECT_COLORS,
  type createProjectSchema,
  type ProjectColor,
  type ProjectDetailDto,
  type ProjectDto,
  type ProjectHistoryDto,
  type updateProjectSchema,
} from '@devpulse/shared';
import type { Prisma, Project } from '@prisma/client';
import type { z } from 'zod';
import { activeSecondsInRange } from '../../database/session-time';
import { notFound } from '../../utils/errors';
import { pageMeta } from '../../utils/pagination';
import { calendarBoundaries } from '../../utils/time';
import { analyticsService } from '../analytics/analytics.service';
import { getUserCalendar } from '../users/user-context';
import {
  projectsRepository,
  type ListProjectsFilters,
  type ProjectRow,
} from './projects.repository';

const isProjectColor = (value: string | null): value is ProjectColor =>
  value !== null && (PROJECT_COLORS as readonly string[]).includes(value);

export function slugify(name: string) {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'project';
}

function rowToDto(row: ProjectRow): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    repositoryUrl: row.repository_url,
    repositoryProvider: row.repository_provider,
    primaryLanguage: row.primary_language,
    color: isProjectColor(row.color) ? row.color : 'blue',
    createdAt: row.created_at.toISOString(),
    lastActivityAt: row.last_activity_at?.toISOString() ?? null,
    archivedAt: row.archived_at?.toISOString() ?? null,
    totalSeconds: row.total_seconds,
    sessionCount: row.session_count,
  };
}

function toDto(
  project: Project,
  totals: { totalSeconds: number; sessionCount: number },
): ProjectDto {
  return rowToDto({
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    repository_url: project.repositoryUrl,
    repository_provider: project.repositoryProvider,
    primary_language: project.primaryLanguage,
    color: project.color,
    created_at: project.createdAt,
    last_activity_at: project.lastActivityAt,
    archived_at: project.archivedAt,
    total_seconds: totals.totalSeconds,
    session_count: totals.sessionCount,
  });
}

async function uniqueSlug(userId: string, name: string, currentSlug?: string) {
  const base = slugify(name);
  if (base === currentSlug) return base;
  const taken = await projectsRepository.existingSlugs(userId, base);
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** Picks the least-used palette colour so new projects stay distinguishable in charts. */
async function nextColor(userId: string): Promise<ProjectColor> {
  const counts = new Map(
    (await projectsRepository.countByColor(userId)).map((row) => [row.color, row._count._all]),
  );
  return (
    [...PROJECT_COLORS].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))[0] ?? 'blue'
  );
}

async function requireOwned(userId: string, id: string) {
  const project = await projectsRepository.findOwned(userId, id);
  if (!project) throw notFound('Project');
  return project;
}

export const projectsService = {
  async list(userId: string, filters: ListProjectsFilters) {
    const { total, rows } = await projectsRepository.list(userId, filters);
    return { data: rows.map(rowToDto), meta: pageMeta(filters.page, filters.pageSize, total) };
  },

  async get(userId: string, id: string): Promise<ProjectDetailDto> {
    const project = await requireOwned(userId, id);
    const calendar = await getUserCalendar(userId);
    const { weekStart } = calendarBoundaries(new Date(), calendar.timezone, calendar.weekStartsOn);

    const [totals, weekSeconds, languages, devices] = await Promise.all([
      projectsRepository.totals(id),
      activeSecondsInRange({ userId, projectId: id }, weekStart, new Date()),
      projectsRepository.languageBreakdown(id),
      projectsRepository.deviceBreakdown(id),
    ]);
    return { ...toDto(project, totals), weekSeconds, languages, devices };
  },

  /** Coding history since the account was created, for the project detail page. */
  async history(userId: string, id: string): Promise<ProjectHistoryDto> {
    await requireOwned(userId, id);
    return analyticsService.projectHistory(userId, id);
  },

  async create(userId: string, input: z.output<typeof createProjectSchema>) {
    const repositoryUrl = input.repositoryUrl ?? null;
    const project = await projectsRepository.create({
      userId,
      name: input.name,
      slug: await uniqueSlug(userId, input.name),
      description: input.description ?? null,
      repositoryUrl,
      repositoryProvider: repositoryUrl ? detectRepositoryProvider(repositoryUrl) : null,
      primaryLanguage: input.primaryLanguage ?? null,
      color: input.color ?? (await nextColor(userId)),
    });
    return toDto(project, { totalSeconds: 0, sessionCount: 0 });
  },

  async update(userId: string, id: string, input: z.output<typeof updateProjectSchema>) {
    const project = await requireOwned(userId, id);
    const data: Prisma.ProjectUpdateInput = {};
    if (input.name !== undefined && input.name !== project.name) {
      data.name = input.name;
      data.slug = await uniqueSlug(userId, input.name, project.slug);
    }
    if (input.description !== undefined) data.description = input.description;
    if (input.repositoryUrl !== undefined) {
      data.repositoryUrl = input.repositoryUrl;
      data.repositoryProvider = input.repositoryUrl
        ? detectRepositoryProvider(input.repositoryUrl)
        : null;
    }
    if (input.primaryLanguage !== undefined) data.primaryLanguage = input.primaryLanguage;
    if (input.color !== undefined) data.color = input.color;
    if (input.archived !== undefined)
      data.archivedAt = input.archived ? (project.archivedAt ?? new Date()) : null;

    const updated = await projectsRepository.update(id, data);
    return toDto(updated, await projectsRepository.totals(id));
  },

  /** Deletes the project. Its sessions are kept (time stays in totals) but become unassigned. */
  async remove(userId: string, id: string) {
    await requireOwned(userId, id);
    await projectsRepository.delete(id);
  },
};
