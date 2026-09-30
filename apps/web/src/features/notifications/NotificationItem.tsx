import type { NotificationDto, NotificationType } from '@devpulse/shared';
import { Laptop, ShieldAlert, Target, Trophy, Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';

const ICONS: Record<NotificationType, typeof Info> = {
  GOAL_PROGRESS: Target,
  GOAL_COMPLETED: Trophy,
  DEVICE_CONNECTED: Laptop,
  DEVICE_REVOKED: Laptop,
  SECURITY: ShieldAlert,
  SESSION_RECORDED: Info,
  SYSTEM: Info,
};

/** One notification row; unread items carry a dot and stronger text. */
export function NotificationItem({
  notification,
  onOpen,
}: {
  notification: NotificationDto;
  onOpen: (notification: NotificationDto) => void;
}) {
  const Icon = ICONS[notification.type];
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
    >
      <span
        className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
          notification.type === 'SECURITY'
            ? 'bg-amber-soft text-amber'
            : 'bg-accent-soft text-accent-ink',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm',
            notification.read ? 'text-ink-muted' : 'font-medium text-ink',
          )}
        >
          {notification.title}
        </span>
        {notification.body && (
          <span className="mt-0.5 block text-sm text-ink-muted">{notification.body}</span>
        )}
        <span className="mt-1 block text-xs text-ink-subtle">
          {formatRelative(notification.createdAt)}
        </span>
      </span>
      {!notification.read && (
        <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-accent" />
      )}
    </button>
  );
}
