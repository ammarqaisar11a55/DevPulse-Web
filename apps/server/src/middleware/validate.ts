import type { RequestHandler } from 'express';
import type { z, ZodType } from 'zod';
import { badRequest } from '../utils/errors';

type Source = 'body' | 'query' | 'params';

export function toFieldErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Validates and coerces a request segment. The parsed result is stored on `req.valid[source]`,
 * because Express 5 exposes `req.query` as a read-only getter.
 */
export function validate<T extends ZodType>(source: Source, schema: T): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(badRequest('Some fields are invalid', toFieldErrors(result.error)));
    }
    req.valid = { ...req.valid, [source]: result.data };
    next();
  };
}

/** Typed accessor for data stored by `validate`. */
export function valid<T>(req: Express.Request, source: Source): T {
  return req.valid?.[source] as T;
}
