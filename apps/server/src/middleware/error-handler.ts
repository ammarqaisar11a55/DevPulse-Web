import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ERROR_CODES, type ApiErrorBody } from '@devpulse/shared';
import { Prisma } from '@prisma/client';
import { AppError, notFound } from '../utils/errors';
import { logger } from '../utils/logger';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`Route ${req.method} ${req.path}`));
};

function normalize(error: unknown): AppError | null {
  if (error instanceof AppError) return error;

  // Malformed JSON bodies surface from express.json() as SyntaxError with a 400 status.
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    return new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Request body is not valid JSON');
  }
  if (typeof error === 'object' && error !== null && 'type' in error) {
    if (error.type === 'entity.too.large') {
      return new AppError(413, ERROR_CODES.VALIDATION_ERROR, 'Request body is too large');
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return notFound();
    if (error.code === 'P2002') {
      return new AppError(409, ERROR_CODES.CONFLICT, 'A record with these values already exists');
    }
  }
  return null;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = normalize(error);

  if (!appError) {
    logger.error({ err: error, requestId: req.id }, 'Unhandled error');
  }

  const status = appError?.status ?? 500;
  const body: ApiErrorBody = {
    error: {
      code: appError?.code ?? ERROR_CODES.INTERNAL_ERROR,
      message: appError?.message ?? 'Something went wrong on our side. Please try again.',
      ...(appError?.details ? { details: appError.details } : {}),
      requestId: String(req.id),
    },
  };

  res.status(status).json(body);
};
