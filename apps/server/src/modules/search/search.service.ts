import {
  SEARCH_GROUP_LIMIT,
  type SearchResponse,
  type SearchResult,
  type SearchType,
} from '@devpulse/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

type GroupType = Exclude<SearchType, 'all'>;

/** ILIKE pattern with LIKE wildcards in the user's input escaped. */
export function containsPattern(query: string) {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

interface Page {
  limit: number;
  offset: number;
}

async function searchProjects(userId: string, pattern: string, page: Page) {
  const where = Prisma.sql`user_id = ${userId}::uuid AND (name ILIKE ${pattern} OR description ILIKE ${pattern} OR repository_url ILIKE ${pattern})`;
  const [count, rows] = await Promise.all([
    prisma.$queryRaw<
      { count: number }[]
    >`SELECT COUNT(*)::int AS count FROM projects WHERE ${where}`,
    prisma.$queryRaw<
      {
        id: string;
        name: string;
        repository_url: string | null;
        primary_language: string | null;
        color: string | null;
        last_activity_at: Date | null;
      }[]
    >`
      SELECT id, name, repository_url, primary_language, color, last_activity_at FROM projects
      WHERE ${where}
      ORDER BY (lower(name) = lower(${pattern.slice(1, -1)})) DESC, last_activity_at DESC NULLS LAST, name
      LIMIT ${page.limit} OFFSET ${page.offset}
    `,
  ]);
  const results: SearchResult[] = rows.map((row) => ({
    id: row.id,
    type: 'projects',
    title: row.name,
    subtitle: row.repository_url?.replace(/^https?:\/\//, '') ?? row.primary_language,
    href: `/projects/${row.id}`,
    color: row.color,
    date: row.last_activity_at?.toISOString() ?? null,
  }));
  return { total: count[0]?.count ?? 0, results };
}

async function searchSessions(userId: string, pattern: string, page: Page) {
  const where = Prisma.sql`cs.user_id = ${userId}::uuid AND (cs.title ILIKE ${pattern} OR cs.branch ILIKE ${pattern} OR cs.repository ILIKE ${pattern})`;
  const [count, rows] = await Promise.all([
    prisma.$queryRaw<
      { count: number }[]
    >`SELECT COUNT(*)::int AS count FROM coding_sessions cs WHERE ${where}`,
    prisma.$queryRaw<
      {
        id: string;
        title: string | null;
        branch: string | null;
        started_at: Date;
        project_id: string | null;
        project_name: string | null;
        color: string | null;
      }[]
    >`
      SELECT cs.id, cs.title, cs.branch, cs.started_at, p.id AS project_id, p.name AS project_name, p.color
      FROM coding_sessions cs
      LEFT JOIN projects p ON p.id = cs.project_id
      WHERE ${where}
      ORDER BY cs.started_at DESC
      LIMIT ${page.limit} OFFSET ${page.offset}
    `,
  ]);
  const results: SearchResult[] = rows.map((row) => ({
    id: row.id,
    type: 'sessions',
    title: row.title ?? (row.branch ? `Worked on ${row.branch}` : 'Coding session'),
    subtitle: row.project_name,
    href: `/sessions/${row.id}`,
    color: row.color,
    date: row.started_at.toISOString(),
  }));
  return { total: count[0]?.count ?? 0, results };
}

async function searchDevices(userId: string, pattern: string, page: Page) {
  const where = Prisma.sql`user_id = ${userId}::uuid AND name ILIKE ${pattern}`;
  const [count, rows] = await Promise.all([
    prisma.$queryRaw<
      { count: number }[]
    >`SELECT COUNT(*)::int AS count FROM devices WHERE ${where}`,
    prisma.$queryRaw<
      {
        id: string;
        name: string;
        platform: string | null;
        revoked_at: Date | null;
        last_seen_at: Date | null;
      }[]
    >`
      SELECT id, name, platform, revoked_at, last_seen_at FROM devices
      WHERE ${where}
      ORDER BY revoked_at IS NOT NULL, last_seen_at DESC NULLS LAST
      LIMIT ${page.limit} OFFSET ${page.offset}
    `,
  ]);
  const results: SearchResult[] = rows.map((row) => ({
    id: row.id,
    type: 'devices',
    title: row.name,
    subtitle: row.revoked_at ? 'Revoked' : row.platform,
    href: '/devices',
    color: null,
    date: row.last_seen_at?.toISOString() ?? null,
  }));
  return { total: count[0]?.count ?? 0, results };
}

const SEARCHERS: Record<GroupType, typeof searchProjects> = {
  projects: searchProjects,
  sessions: searchSessions,
  devices: searchDevices,
};

export const searchService = {
  async search(
    userId: string,
    query: { q: string; type: SearchType; page: number; pageSize: number },
  ): Promise<SearchResponse> {
    const pattern = containsPattern(query.q);
    const types: GroupType[] =
      query.type === 'all' ? ['projects', 'sessions', 'devices'] : [query.type];
    const page: Page =
      query.type === 'all'
        ? { limit: SEARCH_GROUP_LIMIT, offset: 0 }
        : { limit: query.pageSize, offset: (query.page - 1) * query.pageSize };

    const groups = await Promise.all(
      types.map(async (type) => ({ type, ...(await SEARCHERS[type](userId, pattern, page)) })),
    );
    return { query: query.q, groups };
  },
};
