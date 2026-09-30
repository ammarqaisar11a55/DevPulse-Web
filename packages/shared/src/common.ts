import { z } from 'zod';
import { PAGINATION } from './constants';

export const idSchema = z.uuid('Invalid identifier');
export const idParamsSchema = z.object({ id: idSchema });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
});

/** Calendar date in the user's time zone, e.g. 2026-09-30. */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format');

/** Optional query-string filter: empty strings are treated as absent. */
export const optionalQueryString = (max = 100) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const languageSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[\w#+.\- ]+$/, 'Invalid language name')
  .transform((value) => value.toLowerCase());
