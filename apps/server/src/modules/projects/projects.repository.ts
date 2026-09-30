import { Prisma, type RepositoryProvider } from '@prisma/client';
import type { z } from 'zod';
import type { listProjectsQuerySchema } from '@devpulse/shared';
import { prisma } from '../../database/prisma';
import { skipTake } from '../../utils/pagination';

export type ListProjectsFilters = z.output<typeof listProjectsQuerySchema>;

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  repository_url: string | null;
  repository_provider: RepositoryProvider | null;
  primary_language: string | null;
  color: string | null;
  created_at: Date;
  last_activity_at: Date | null;
  archived_at: Date | null;
  total_seconds: number;
  session_count: number;
}

function sqlConditions(userId: string, filters: ListProjectsFilters) {
  const conditions = [Prisma.sql`p.user_id = ${userId}::uuid`];
  if (filters.status === 'active') conditions.push(Prisma.sql`p.archived_at IS NULL`);
  if (filters.status === 'archived') conditions.push(Prisma.sql`p.archived_at IS NOT NULL`);
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    conditions.push(Prisma.sql`(p.name ILIKE ${pattern} OR p.repository_url ILIKE ${pattern})`);
  }
  if (filters.language)
    conditions.push(Prisma.sql`p.primary_language = ${filters.language.toLowerCase()}`);
  return Prisma.join(conditions, ' AND ');
}

const ORDER_BY: Record<ListProjectsFilters['sort'], Prisma.Sql> = {
  recent: Prisma.sql`p.last_activity_at DESC NULLS LAST, p.created_at DESC, p.id`,
  name: Prisma.sql`lower(p.name) ASC, p.id`,
  time: Prisma.sql`total_seconds DESC, lower(p.name) ASC, p.id`,
  created: Prisma.sql`p.created_at DESC, p.id`,
};

export const projectsRepository = {
  async list(userId: string, filters: ListProjectsFilters) {
    const { skip, take } = skipTake(filters.page, filters.pageSize);
    const [total, rows] = await Promise.all([
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM projects p WHERE ${sqlConditions(userId, filters)}
      `.then((result) => result[0]?.count ?? 0),
      prisma.$queryRaw<ProjectRow[]>`
        SELECT p.id, p.name, p.slug, p.description, p.repository_url, p.repository_provider, p.primary_language,
               p.color, p.created_at, p.last_activity_at, p.archived_at,
               COALESCE(s.total_seconds, 0)::int AS total_seconds,
               COALESCE(s.session_count, 0)::int AS session_count
        FROM projects p
        LEFT JOIN (
          SELECT project_id, SUM(active_seconds) AS total_seconds, COUNT(*) AS session_count
          FROM coding_sessions
          WHERE user_id = ${userId}::uuid AND project_id IS NOT NULL
          GROUP BY project_id
        ) s ON s.project_id = p.id
        WHERE ${sqlConditions(userId, filters)}
        ORDER BY ${ORDER_BY[filters.sort]}
        LIMIT ${take} OFFSET ${skip}
      `,
    ]);
    return { total, rows };
  },

  findOwned(userId: string, id: string) {
    return prisma.project.findFirst({ where: { id, userId } });
  },

  async totals(projectId: string) {
    const result = await prisma.codingSession.aggregate({
      where: { projectId },
      _sum: { activeSeconds: true },
      _count: { _all: true },
    });
    return { totalSeconds: result._sum.activeSeconds ?? 0, sessionCount: result._count._all };
  },

  languageBreakdown(projectId: string) {
    return prisma.$queryRaw<{ language: string; seconds: number }[]>`
      SELECT sl.language, SUM(sl.active_seconds)::int AS seconds
      FROM session_languages sl
      JOIN coding_sessions cs ON cs.id = sl.session_id
      WHERE cs.project_id = ${projectId}::uuid
      GROUP BY sl.language
      ORDER BY seconds DESC
      LIMIT 8
    `;
  },

  deviceBreakdown(projectId: string) {
    return prisma.$queryRaw<{ id: string; name: string; seconds: number }[]>`
      SELECT d.id, d.name, SUM(cs.active_seconds)::int AS seconds
      FROM coding_sessions cs
      JOIN devices d ON d.id = cs.device_id
      WHERE cs.project_id = ${projectId}::uuid
      GROUP BY d.id, d.name
      ORDER BY seconds DESC
    `;
  },

  existingSlugs(userId: string, base: string) {
    return prisma.project
      .findMany({ where: { userId, slug: { startsWith: base } }, select: { slug: true } })
      .then((rows) => new Set(rows.map((row) => row.slug)));
  },

  countByColor(userId: string) {
    return prisma.project.groupBy({ by: ['color'], where: { userId }, _count: { _all: true } });
  },

  create(data: Prisma.ProjectUncheckedCreateInput) {
    return prisma.project.create({ data });
  },

  update(id: string, data: Prisma.ProjectUpdateInput) {
    return prisma.project.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.project.delete({ where: { id } });
  },
};
