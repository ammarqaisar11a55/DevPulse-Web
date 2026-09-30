import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, IconButton } from '@/components/ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { NotificationItem } from './NotificationItem';
import { notificationKeys, notificationsApi } from './notifications-api';
import { useNotificationActions } from './useNotificationActions';

const RECENT = { page: 1, pageSize: 8 } as const;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unread = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) => notificationsApi.unreadCount(signal),
    refetchInterval: 60_000,
  });
  const recent = useQuery({
    queryKey: notificationKeys.list(RECENT),
    queryFn: ({ signal }) => notificationsApi.list(RECENT, signal),
    enabled: open,
  });
  const { open: openNotification, markAll } = useNotificationActions(() => setOpen(false));
  const count = unread.data?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton
          aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
          className="relative"
        >
          <Bell />
          {count > 0 && (
            <span className="tabular absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-ink-inverse">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </IconButton>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-2rem))]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-medium">Notifications</p>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              loading={markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {recent.isPending ? (
            <SkeletonRows rows={3} className="p-4" />
          ) : recent.isError || recent.data.data.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              {recent.isError ? 'Notifications could not be loaded.' : 'You are all caught up.'}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.data.data.map((notification) => (
                <li key={notification.id}>
                  <NotificationItem notification={notification} onOpen={openNotification} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          to="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-line px-4 py-2.5 text-center text-sm text-accent hover:bg-surface-2"
        >
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}
