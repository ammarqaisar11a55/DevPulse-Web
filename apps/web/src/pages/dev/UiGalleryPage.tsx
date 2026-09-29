import { FolderGit2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Badge, ColorDot } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmDialog, Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Switch } from '@/components/ui/Switch';
import { toast } from 'sonner';
import { ThemePicker } from '@/features/theme/ThemeToggle';
import { AppShell } from '@/layouts/AppShell';
import { ApiError } from '@/lib/api-client';

const rows = [
  {
    id: '1',
    project: 'Notes Saver',
    color: 'var(--chart-1)',
    duration: '1h 21m',
    device: 'Ubuntu laptop',
  },
  { id: '2', project: 'PortPilot', color: 'var(--chart-2)', duration: '43m', device: 'Desktop PC' },
];

/** Development-only reference of every UI primitive in the current theme. */
function Gallery() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  return (
    <>
      <PageHeader
        title="Design system"
        description="Every primitive, rendered in the active theme."
        actions={<ThemePicker />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Buttons" description="Variants, sizes and states" />
          <PanelBody className="flex flex-wrap gap-3">
            <Button leadingIcon={<Plus />}>New project</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)} leadingIcon={<Trash2 />}>
              Revoke
            </Button>
            <Button loading>Saving</Button>
            <Button size="sm" variant="secondary" onClick={() => toast.success('Project saved')}>
              Show toast
            </Button>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Form controls" />
          <PanelBody className="grid gap-4">
            <Field label="Project name" hint="Shown on your dashboard.">
              <Input placeholder="Notes Saver" />
            </Field>
            <Field label="Repository URL" error="Enter a valid URL">
              <Input defaultValue="not a url" />
            </Field>
            <Field label="Language" optional>
              <Select defaultValue="ts">
                <option value="ts">TypeScript</option>
                <option value="cpp">C++</option>
              </Select>
            </Field>
            <Field label="Description">
              <Textarea placeholder="What is this project about?" />
            </Field>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              label="Track branch names"
              description="Send the current git branch with each session."
            />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Badges and dialogs" />
          <PanelBody className="flex flex-wrap items-center gap-3">
            <Badge>Neutral</Badge>
            <Badge tone="accent">Active</Badge>
            <Badge tone="success">Connected</Badge>
            <Badge tone="amber">Idle</Badge>
            <Badge tone="danger">Revoked</Badge>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  Open dialog
                </Button>
              </DialogTrigger>
              <DialogContent
                title="Create project"
                description="Projects group your coding sessions."
                footer={<Button>Create project</Button>}
              >
                <Field label="Name">
                  <Input />
                </Field>
              </DialogContent>
            </Dialog>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Loading" />
          <PanelBody className="grid gap-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </PanelBody>
        </Panel>
        <Panel className="lg:col-span-2">
          <PanelHeader title="Table" description="Stacks into a list on small screens" />
          <div className="mt-4">
            <DataTable
              caption="Example sessions"
              rows={rows}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: 'project',
                  header: 'Project',
                  mobile: 'primary',
                  cell: (row) => (
                    <span className="flex items-center gap-2">
                      <ColorDot color={row.color} />
                      {row.project}
                    </span>
                  ),
                },
                {
                  key: 'duration',
                  header: 'Duration',
                  align: 'right',
                  cell: (row) => row.duration,
                },
                { key: 'device', header: 'Device', cell: (row) => row.device },
              ]}
            />
            <Pagination
              meta={{ page: 1, pageSize: 20, total: 42, totalPages: 3 }}
              onPageChange={() => undefined}
            />
          </div>
        </Panel>
        <Panel>
          <EmptyState
            icon={<FolderGit2 />}
            title="No projects yet"
            description="Projects appear here once you create one or your editor reports activity."
            action={<Button size="sm">Create project</Button>}
          />
        </Panel>
        <Panel>
          <ErrorState
            error={new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side.')}
            onRetry={() => undefined}
          />
        </Panel>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Revoke this device?"
        description="The extension on this device will stop syncing immediately."
        confirmLabel="Revoke device"
        onConfirm={() => setConfirmOpen(false)}
      />
    </>
  );
}

export function UiGalleryPage() {
  return (
    <AppShell>
      <Gallery />
    </AppShell>
  );
}
