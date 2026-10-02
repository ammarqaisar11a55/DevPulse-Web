import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ListSessionsQuery, SessionSource } from '@devpulse/shared';
import { ListTree, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ActivityFilterBar } from '@/features/activity/components/ActivityFilterBar';
import { useActivityFilters } from '@/features/activity/useActivityFilters';
import { useCurrentUser } from '@/features/auth/auth-context';
import { LogSessionDialog } from './components/LogSessionDialog';
import { sessionColumns } from './components/session-columns';
import { sessionKeys, sessionsApi } from './sessions-api';

type Sort = NonNullable<ListSessionsQuery['sort']>;
type SourceFilter = Extract<SessionSource, 'EXTENSION' | 'MANUAL'> | 'all';

const PAGE_SIZE = 25;

export function SessionsPage() {
  const user = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const [logging, setLogging] = useState(false);
  const filters = useActivityFilters('all');

  const sort = (params.get('sort') as Sort | null) ?? 'recent';
  const source = (params.get('source') as SourceFilter | null) ?? 'all';
  const page = Number(params.get('page') ?? 1) || 1;

  const query: ListSessionsQuery = {
    ...filters.query,
    sort,
    source: source === 'all' ? undefined : source,
    page,
    pageSize: PAGE_SIZE,
  };
  const sessions = useQuery({
    queryKey: sessionKeys.list(query),
    queryFn: ({ signal }) => sessionsApi.list(query, signal),
    placeholderData: keepPreviousData,
  });

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const rows = sessions.data?.data ?? [];
  const filtered = filters.activeCount > 0 || filters.state.range !== 'all' || source !== 'all';

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Every coding session, with its active and idle time."
        actions={
          <Button variant="secondary" leadingIcon={<Plus />} onClick={() => setLogging(true)}>
            Log a session
          </Button>
        }
      />

      <ActivityFilterBar
        state={filters.state}
        onChange={filters.update}
        onReset={filters.reset}
        activeCount={filters.activeCount}
        ranges={['today', 'yesterday', '7d', '30d', '90d', 'all']}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SegmentedControl<SourceFilter>
          label="Recorded by"
          value={source}
          onChange={(value) => updateParam('source', value === 'all' ? null : value)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'EXTENSION', label: 'Editor' },
            { value: 'MANUAL', label: 'Logged manually' },
          ]}
        />
        <Select
          aria-label="Sort sessions"
          value={sort}
          onChange={(event) =>
            updateParam('sort', event.target.value === 'recent' ? null : event.target.value)
          }
          className="sm:ml-auto sm:w-48"
        >
          <option value="recent">Most recent</option>
          <option value="oldest">Oldest first</option>
          <option value="longest">Most active time</option>
        </Select>
      </div>

      <Panel aria-busy={sessions.isFetching}>
        {sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : (
          <>
            <DataTable
              caption="Coding sessions"
              loading={sessions.isPending}
              rows={rows}
              rowKey={(session) => session.id}
              rowHref={(session) => `/sessions/${session.id}`}
              columns={sessionColumns(user.timezone)}
              empty={
                filtered ? (
                  <EmptyState
                    compact
                    icon={<SearchX />}
                    title="No sessions match these filters"
                    description="Try a longer date range or clear the filters."
                  />
                ) : (
                  <EmptyState
                    icon={<ListTree />}
                    title="No sessions yet"
                    description="Connect the DevPulse VS Code extension to record sessions automatically, or log one by hand."
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        <ButtonLink to="/settings/integrations">Connect VS Code</ButtonLink>
                        <Button
                          variant="secondary"
                          leadingIcon={<Plus />}
                          onClick={() => setLogging(true)}
                        >
                          Log a session
                        </Button>
                      </div>
                    }
                  />
                )
              }
            />
            {sessions.data && sessions.data.meta.totalPages > 1 && (
              <Pagination
                meta={sessions.data.meta}
                onPageChange={(next) => updateParam('page', String(next))}
              />
            )}
          </>
        )}
      </Panel>

      {logging && <LogSessionDialog open onOpenChange={setLogging} />}
    </>
  );
}
