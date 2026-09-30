import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NotificationDto } from '@devpulse/shared';
import { useNavigate } from 'react-router';
import { notificationKeys, notificationsApi } from './notifications-api';

/** Opening marks a notification read and follows its link; also exposes mark-all-read. */
export function useNotificationActions(onNavigate?: () => void) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all });

  const mark = useMutation({
    mutationFn: (id: string) => notificationsApi.mark(id, true),
    onSuccess: refresh,
  });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh });

  const open = (notification: NotificationDto) => {
    if (!notification.read) mark.mutate(notification.id);
    if (notification.link) {
      onNavigate?.();
      navigate(notification.link);
    }
  };

  return { open, markAll };
}
