import { z } from 'zod';
import { paginationQuerySchema } from './common';

export const SEARCH_TYPES = ['all', 'projects', 'sessions', 'devices'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/** Results per group when searching everything at once. */
export const SEARCH_GROUP_LIMIT = 5;

export const searchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(2, 'Type at least two characters').max(80),
  type: z.enum(SEARCH_TYPES).default('all'),
});
export type SearchQuery = Partial<z.output<typeof searchQuerySchema>>;

export interface SearchResult {
  id: string;
  type: Exclude<SearchType, 'all'>;
  title: string;
  subtitle: string | null;
  /** In-app path for the result. */
  href: string;
  /** Project colour key, when relevant. */
  color: string | null;
  date: string | null;
}

export interface SearchResponse {
  query: string;
  groups: { type: Exclude<SearchType, 'all'>; total: number; results: SearchResult[] }[];
}
