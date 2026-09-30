import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { NotificationItem } from './NotificationItem';
import { notificationKeys, notificationsApi } from './notifications-api';
import { useNotificationActions } from './useNotificationActions';

type Filter = 'all' | 'unread';

export function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const query = { page, pageSize: 20, unread: filter === 'unread' ? ('true' as const) : undefined };
  const list = useQuery({
    queryKey: notificationKeys.list(query),
    queryFn: ({ signal }) => notificationsApi.list(query, signal),
    placeholderData: keepPreviousData,
  });
  const { open, markAll } = useNotificationActions();

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Goal progress, device and security updates for your account."
        actions={
          <>
            <SegmentedControl<Filter>
              label="Show"
              value={filter}
              onChange={(next) => {
                setFilter(next);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All' },
                { value: 'unread', label: 'Unread' },
              ]}
            />
            {(list.data?.meta.unread ?? 0) > 0 && (
              <Button
                variant="secondary"
                loading={markAll.isPending}
                onClick={() => markAll.mutate()}
              >
                Mark all read
              </Button>
            )}
          </>
        }
      />
      <Panel aria-busy={list.isFetching}>
        {list.isPending ? (
          <SkeletonRows rows={5} className="p-5" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.data.length === 0 ? (
          <EmptyState
            icon={<Bell />}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description="You will hear about goal progress, new devices and security changes here."
          />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {list.data.data.map((notification) => (
                <li key={notification.id}>
                  <NotificationItem notification={notification} onOpen={open} />
                </li>
              ))}
            </ul>
            {list.data.meta.totalPages > 1 && (
              <Pagination meta={list.data.meta} onPageChange={setPage} />
            )}
          </>
        )}
      </Panel>
    </>
  );
}
