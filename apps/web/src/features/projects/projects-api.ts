import type {
  CreateProjectInput,
  ListProjectsQuery,
  PaginatedResponse,
  ProjectDetailDto,
  ProjectDto,
  UpdateProjectInput,
} from '@devpulse/shared';
import { api, apiRequest } from '@/lib/api-client';

export const projectKeys = {
  all: ['projects'] as const,
  list: (query: ListProjectsQuery) => ['projects', 'list', query] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
};

export const projectsApi = {
  list: (query: ListProjectsQuery, signal?: AbortSignal) =>
    apiRequest<PaginatedResponse<ProjectDto>>('/projects', { query: { ...query }, signal }),
  get: (id: string, signal?: AbortSignal) =>
    api.get<ProjectDetailDto>(`/projects/${id}`, { signal }),
  create: (input: CreateProjectInput) => api.post<ProjectDto>('/projects', input),
  update: (id: string, input: UpdateProjectInput) =>
    api.patch<ProjectDto>(`/projects/${id}`, input),
  remove: (id: string) => api.delete(`/projects/${id}`),
};
