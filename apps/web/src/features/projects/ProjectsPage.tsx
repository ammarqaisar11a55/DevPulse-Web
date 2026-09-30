import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ListProjectsQuery, ProjectDto } from '@devpulse/shared';
import { FolderGit2, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { ShareBar } from '@/components/ShareBar';
import { Badge, ColorDot } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { projectColor } from '@/lib/colors';
import { formatDuration, formatRelative } from '@/lib/format';
import { languageName } from '@/lib/languages';
import { ProjectFormDialog } from './components/ProjectFormDialog';
import { ProviderIcon } from './components/ProviderIcon';
import { projectKeys, projectsApi } from './projects-api';

type Status = NonNullable<ListProjectsQuery['status']>;
type Sort = NonNullable<ListProjectsQuery['sort']>;

const PAGE_SIZE = 20;

function ProjectRow({ project, maxSeconds }: { project: ProjectDto; maxSeconds: number }) {
  return (
    <li>
      <Link
        to={`/projects/${project.id}`}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem]"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2.5 font-medium">
            <ColorDot color={projectColor(project.color)} />
            <span className="truncate">{project.name}</span>
            {project.archivedAt && <Badge>Archived</Badge>}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 text-sm text-ink-muted">
            {project.primaryLanguage && <span>{languageName(project.primaryLanguage)}</span>}
            {project.repositoryProvider && (
              <span className="inline-flex items-center gap-1">
                <ProviderIcon provider={project.repositoryProvider} />
                <span className="max-w-48 truncate">
                  {project.repositoryUrl?.replace(/^https?:\/\/(www\.)?/, '')}
                </span>
              </span>
            )}
            <span>
              {project.lastActivityAt
                ? `Active ${formatRelative(project.lastActivityAt).toLowerCase()}`
                : 'No activity yet'}
            </span>
          </p>
        </div>
        <div className="col-span-2 row-start-2 pl-5 md:col-span-1 md:row-start-auto md:pl-0">
          <ShareBar
            ratio={maxSeconds > 0 ? project.totalSeconds / maxSeconds : 0}
            color={projectColor(project.color)}
          />
        </div>
        <div className="row-start-1 text-right md:row-start-auto">
          <p className="tabular font-display text-lg font-semibold">
            {formatDuration(project.totalSeconds)}
          </p>
          <p className="text-xs text-ink-muted">
            {project.sessionCount} {project.sessionCount === 1 ? 'session' : 'sessions'}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [creating, setCreating] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());

  const status = (params.get('status') as Status | null) ?? 'active';
  const sort = (params.get('sort') as Sort | null) ?? 'recent';
  const page = Number(params.get('page') ?? 1) || 1;

  const query: ListProjectsQuery = {
    status,
    sort,
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
  };
  const projects = useQuery({
    queryKey: projectKeys.list(query),
    queryFn: ({ signal }) => projectsApi.list(query, signal),
    placeholderData: keepPreviousData,
  });

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const rows = projects.data?.data ?? [];
  const maxSeconds = Math.max(0, ...rows.map((project) => project.totalSeconds));
  const filtered = Boolean(debouncedSearch) || status !== 'active';

  return (
    <>
      <PageHeader
        title="Projects"
        description="Where your coding time goes, project by project."
        actions={
          <Button leadingIcon={<Plus />} onClick={() => setCreating(true)}>
            New project
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search projects"
            placeholder="Search projects"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              updateParam('page', null);
            }}
            className="pl-9"
          />
        </div>
        <SegmentedControl<Status>
          label="Project status"
          value={status}
          onChange={(value) => updateParam('status', value === 'active' ? null : value)}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
            { value: 'all', label: 'All' },
          ]}
        />
        <Select
          aria-label="Sort projects"
          value={sort}
          onChange={(event) =>
            updateParam('sort', event.target.value === 'recent' ? null : event.target.value)
          }
          className="sm:ml-auto sm:w-48"
        >
          <option value="recent">Recently active</option>
          <option value="time">Most coding time</option>
          <option value="name">Name</option>
          <option value="created">Newest</option>
        </Select>
      </div>

      <Panel aria-busy={projects.isFetching}>
        {projects.isPending ? (
          <SkeletonRows rows={5} className="p-5" />
        ) : projects.isError ? (
          <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState
              compact
              icon={<Search />}
              title="No matching projects"
              description="Try a different search or filter."
            />
          ) : (
            <EmptyState
              icon={<FolderGit2 />}
              title="No projects yet"
              description="Create a project to start organising your sessions. When the DevPulse extension is connected, projects are created from your workspaces automatically."
              action={
                <Button leadingIcon={<Plus />} onClick={() => setCreating(true)}>
                  New project
                </Button>
              }
            />
          )
        ) : (
          <>
            <ul className="divide-y divide-line">
              {rows.map((project) => (
                <ProjectRow key={project.id} project={project} maxSeconds={maxSeconds} />
              ))}
            </ul>
            {projects.data.meta.totalPages > 1 && (
              <Pagination
                meta={projects.data.meta}
                onPageChange={(next) => updateParam('page', String(next))}
              />
            )}
          </>
        )}
      </Panel>

      {creating && (
        <ProjectFormDialog
          open
          onOpenChange={setCreating}
          onSaved={(project) => navigate(`/projects/${project.id}`)}
        />
      )}
    </>
  );
}
