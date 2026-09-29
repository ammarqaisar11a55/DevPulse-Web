import {
  ERROR_CODES,
  type ApiErrorBody,
  type ApiFieldError,
  type ErrorCode,
} from '@devpulse/shared';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details: ApiFieldError[] = [],
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages keyed by the first path segment, for form display. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((detail) => [detail.path, detail.message]));
  }
}

type QueryValue = string | number | boolean | null | undefined | Date;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue | QueryValue[]>;
  signal?: AbortSignal;
  /** Attach the access token and retry once after refreshing it on 401. */
  auth?: boolean;
}

/* Access token lives in memory only; the refresh token is an httpOnly cookie. */
let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};

/** Registered by the auth feature so the client can transparently renew access tokens. */
export function configureAuthHandlers(handlers: {
  refresh: () => Promise<string | null>;
  onUnauthorized: () => void;
}) {
  refreshHandler = handlers.refresh;
  unauthorizedHandler = handlers.onUnauthorized;
}

/** Collapses concurrent refresh attempts into a single network request. */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshHandler) return Promise.resolve(null);
  refreshInFlight ??= refreshHandler().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = `${API_BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value === undefined || value === null || value === '') continue;
      params.append(key, value instanceof Date ? value.toISOString() : String(value));
    }
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'Some of the information you entered is invalid.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  409: 'That conflicts with existing data.',
  429: 'You are doing that too often. Please wait a moment and try again.',
  500: 'Something went wrong on our side. Please try again.',
};

async function toApiError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = null;
  }
  const status = response.status;
  const code =
    body?.error?.code ??
    (status >= 500 ? ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.VALIDATION_ERROR);
  const message =
    body?.error?.message ?? FALLBACK_MESSAGES[status] ?? FALLBACK_MESSAGES[500] ?? 'Request failed';
  return new ApiError(status, code, message, body?.error?.details ?? [], body?.error?.requestId);
}

async function send(path: string, options: RequestOptions, token: string | null) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-DevPulse-Client': 'web',
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'include',
    signal: options.signal,
  });
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth ?? true;
  let response: Response;
  try {
    response = await send(path, options, useAuth ? accessToken : null);
    if (response.status === 401 && useAuth) {
      const renewed = await refreshAccessToken();
      if (!renewed) {
        unauthorizedHandler?.();
        throw await toApiError(response);
      }
      response = await send(path, options, renewed);
    }
  } catch (error) {
    if (
      error instanceof ApiError ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw error;
    }
    throw new ApiError(
      0,
      ERROR_CODES.INTERNAL_ERROR,
      'Unable to reach DevPulse. Check your connection.',
    );
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Convenience helpers that unwrap the `{ data }` envelope. */
export const api = {
  get: async <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    (await apiRequest<{ data: T }>(path, { ...options, method: 'GET' })).data,
  post: async <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => (await apiRequest<{ data: T }>(path, { ...options, method: 'POST', body }))?.data,
  patch: async <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => (await apiRequest<{ data: T }>(path, { ...options, method: 'PATCH', body }))?.data,
  put: async <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    (await apiRequest<{ data: T }>(path, { ...options, method: 'PUT', body }))?.data,
  delete: async (path: string, options?: Omit<RequestOptions, 'method' | 'body'>) => {
    await apiRequest<void>(path, { ...options, method: 'DELETE' });
  },
};

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) {
  if (error instanceof ApiError) return error.message;
  return fallback;
}
