import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { BreakdownList } from '@/components/BreakdownList';
import { StatStrip } from '@/components/StatStrip';
import { Badge, ColorDot } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ApiError, getErrorMessage } from '@/lib/api-client';
import { projectColor } from '@/lib/colors';
import { formatDate, formatDuration, formatRelative } from '@/lib/format';
import { languageName } from '@/lib/languages';
import { foldSeries } from '@/lib/series';
import { ProjectFormDialog } from './components/ProjectFormDialog';
import { ProjectHistory } from './components/ProjectHistory';
import { providerLabel } from './provider-label';
import { projectKeys, projectsApi } from './projects-api';

export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const project = useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: ({ signal }) => projectsApi.get(projectId, signal),
  });

  const archive = useMutation({
    mutationFn: (archived: boolean) => projectsApi.update(projectId, { archived }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success(updated.archivedAt ? 'Project archived' : 'Project restored');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => projectsApi.remove(projectId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success('Project deleted');
      navigate('/projects', { replace: true });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (project.isError) {
    const missing = project.error instanceof ApiError && project.error.status === 404;
    return (
      <Panel>
        {missing ? (
          <EmptyState
            title="Project not found"
            description="It may have been deleted."
            action={
              <Link to="/projects" className="text-accent hover:underline">
                Back to projects
              </Link>
            }
          />
        ) : (
          <ErrorState error={project.error} onRetry={() => void project.refetch()} />
        )}
      </Panel>
    );
  }

  const data = project.data;

  return (
    <>
      <Link
        to="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Projects
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {data ? (
            <>
              <h1 className="flex items-center gap-3 text-2xl font-semibold sm:text-[1.75rem]">
                <ColorDot color={projectColor(data.color)} className="size-3.5" />
                <span className="truncate">{data.name}</span>
                {data.archivedAt && <Badge>Archived</Badge>}
              </h1>
              {data.description && (
                <p className="mt-1.5 max-w-2xl text-ink-muted">{data.description}</p>
              )}
            </>
          ) : (
            <Skeleton className="h-9 w-64" />
          )}
        </div>
        {data && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label="Project actions" className="border border-line bg-surface">
                <MoreHorizontal />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil />
                Edit project
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => archive.mutate(!data.archivedAt)}>
                {data.archivedAt ? <ArchiveRestore /> : <Archive />}
                {data.archivedAt ? 'Restore project' : 'Archive project'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" onSelect={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <StatStrip
        loading={!data}
        className="mb-6"
        stats={[
          {
            label: 'Total coding time',
            value: formatDuration(data?.totalSeconds ?? 0),
            hint: 'All time',
          },
          { label: 'This week', value: formatDuration(data?.weekSeconds ?? 0) },
          { label: 'Sessions', value: (data?.sessionCount ?? 0).toLocaleString() },
          {
            label: 'Last activity',
            value: data?.lastActivityAt ? formatRelative(data.lastActivityAt) : 'None yet',
          },
        ]}
      />

      <ProjectHistory projectId={projectId} />

      {/* grid-cols-1 caps the column at the viewport, so long repository URLs truncate. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Languages" description="Active coding time by language." />
          <PanelBody>
            {data ? (
              <BreakdownList
                empty="Language data appears once sessions are recorded for this project."
                items={foldSeries(data.languages, (item) => ({
                  key: item.language,
                  label: languageName(item.language),
                  seconds: item.seconds,
                }))}
              />
            ) : (
              <Skeleton className="h-32 w-full" />
            )}
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title="About" />
            <PanelBody>
              {data ? (
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-ink-muted">Repository</dt>
                    <dd>
                      {data.repositoryUrl ? (
                        <a
                          href={data.repositoryUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex max-w-full items-center gap-1 text-accent hover:underline"
                        >
                          <span className="truncate">
                            {providerLabel(data.repositoryProvider)}:{' '}
                            {data.repositoryUrl.replace(/^https?:\/\//, '')}
                          </span>
                          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                        </a>
                      ) : (
                        'Not linked'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Primary language</dt>
                    <dd>{data.primaryLanguage ? languageName(data.primaryLanguage) : 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Created</dt>
                    <dd>{formatDate(data.createdAt, { dateStyle: 'long' })}</dd>
                  </div>
                </dl>
              ) : (
                <Skeleton className="h-24 w-full" />
              )}
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader
              title="Contributing devices"
              description="Where this project's time was recorded."
            />
            <PanelBody>
              {data ? (
                <BreakdownList
                  empty="No editor has recorded time for this project yet."
                  items={foldSeries(data.devices, (device) => ({
                    key: device.id,
                    label: device.name,
                    seconds: device.seconds,
                  }))}
                />
              ) : (
                <Skeleton className="h-16 w-full" />
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>

      {editing && data && <ProjectFormDialog open onOpenChange={setEditing} project={data} />}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this project?"
        description="The project is removed. Its sessions are kept and still count towards your totals, but will no longer be assigned to a project."
        confirmLabel="Delete project"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
