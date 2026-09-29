import { ERROR_CODES, type ApiFieldError, type ErrorCode } from '@devpulse/shared';

/**
 * Operational error that is safe to show to API consumers.
 * Anything that is not an AppError is treated as an internal failure and masked.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ApiFieldError[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message = 'The request is invalid', details?: ApiFieldError[]) =>
  new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, details);

export const unauthorized = (message = 'Authentication is required') =>
  new AppError(401, ERROR_CODES.UNAUTHORIZED, message);

export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, ERROR_CODES.FORBIDDEN, message);

export const notFound = (resource = 'Resource') =>
  new AppError(404, ERROR_CODES.NOT_FOUND, `${resource} not found`);

export const conflict = (message: string, details?: ApiFieldError[]) =>
  new AppError(409, ERROR_CODES.CONFLICT, message, details);

export const rateLimited = (message = 'Too many requests. Please try again later.') =>
  new AppError(429, ERROR_CODES.RATE_LIMITED, message);
