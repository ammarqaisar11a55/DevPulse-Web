import type { ListNotificationsQuery, NotificationDto, PageMeta } from '@devpulse/shared';
import { api, apiRequest } from '@/lib/api-client';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (query: ListNotificationsQuery) => ['notifications', 'list', query] as const,
  unread: ['notifications', 'unread-count'] as const,
};

export const notificationsApi = {
  list: (query: ListNotificationsQuery, signal?: AbortSignal) =>
    apiRequest<{ data: NotificationDto[]; meta: PageMeta & { unread: number } }>('/notifications', {
      query: { ...query },
      signal,
    }),
  unreadCount: (signal?: AbortSignal) =>
    api.get<{ count: number }>('/notifications/unread-count', { signal }),
  mark: (id: string, read: boolean) =>
    apiRequest<void>(`/notifications/${id}`, { method: 'PATCH', body: { read } }),
  markAllRead: () => api.post<{ updated: number }>('/notifications/read-all'),
  remove: (id: string) => api.delete(`/notifications/${id}`),
};
