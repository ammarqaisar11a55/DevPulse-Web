import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, getErrorMessage } from './api-client';

/**
 * Maps server-side field errors onto a react-hook-form instance. `rename` translates server
 * field names to form field names when they differ.
 * Returns a general message when the error is not field-specific.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  rename: Record<string, Path<T>> = {},
) {
  if (error instanceof ApiError && error.details.length > 0) {
    let applied = false;
    for (const detail of error.details) {
      const field = rename[detail.path] ?? (detail.path as Path<T>);
      if (fields.includes(field)) {
        setError(field, { type: 'server', message: detail.message });
        applied = true;
      }
    }
    if (applied) return null;
  }
  return getErrorMessage(error);
}
