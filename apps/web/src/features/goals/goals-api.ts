import type { CreateGoalInput, GoalDto, UpdateGoalInput } from '@devpulse/shared';
import { api } from '@/lib/api-client';

export const goalKeys = {
  all: ['goals'] as const,
  list: (archived: boolean) => ['goals', { archived }] as const,
};

export const goalsApi = {
  list: (archived = false, signal?: AbortSignal) =>
    api.get<GoalDto[]>('/goals', { query: { archived }, signal }),
  create: (input: CreateGoalInput) => api.post<GoalDto>('/goals', input),
  update: (id: string, input: UpdateGoalInput) => api.patch<GoalDto>(`/goals/${id}`, input),
  remove: (id: string) => api.delete(`/goals/${id}`),
};
