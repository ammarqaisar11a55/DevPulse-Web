import type {
  CodingSessionDetailDto,
  CodingSessionDto,
  CreateSessionInput,
  ListSessionsQuery,
  PaginatedResponse,
} from '@devpulse/shared';
import type { QueryClient } from '@tanstack/react-query';
import { api, apiRequest } from '@/lib/api-client';

export const sessionKeys = {
  all: ['sessions'] as const,
  list: (query: ListSessionsQuery) => ['sessions', 'list', query] as const,
  detail: (id: string) => ['sessions', 'detail', id] as const,
};

export const sessionsApi = {
  list: (query: ListSessionsQuery, signal?: AbortSignal) =>
    apiRequest<PaginatedResponse<CodingSessionDto>>('/sessions', { query: { ...query }, signal }),
  get: (id: string, signal?: AbortSignal) =>
    api.get<CodingSessionDetailDto>(`/sessions/${id}`, { signal }),
  create: (input: CreateSessionInput) => api.post<CodingSessionDto>('/sessions', input),
  update: (id: string, input: { title?: string | null; projectId?: string | null }) =>
    api.patch<CodingSessionDto>(`/sessions/${id}`, input),
  remove: (id: string) => api.delete(`/sessions/${id}`),
};

/** Human-friendly label for a session. */
export function sessionTitle(session: Pick<CodingSessionDto, 'title' | 'branch'>) {
  if (session.title) return session.title;
  if (session.branch && session.branch !== 'main' && session.branch !== 'master')
    return `Worked on ${session.branch}`;
  return 'Coding session';
}

/** Refreshes every view derived from session time after a session is added, edited or removed. */
export function invalidateSessionData(queryClient: QueryClient) {
  for (const queryKey of [sessionKeys.all, ['activity'], ['analytics'], ['projects'], ['goals']]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}
