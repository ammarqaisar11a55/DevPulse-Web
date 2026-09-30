import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeviceDto } from '@devpulse/shared';
import { Laptop, MoreHorizontal, Pencil, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink, IconButton } from '@/components/ui/Button';
import { ConfirmDialog, Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Field, Input } from '@/components/ui/Field';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDate, formatDuration, formatRelative } from '@/lib/format';
import { devicesApi, devicesKey, isOnline, platformName } from './devices-api';

function RenameDialog({ device, onClose }: { device: DeviceDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(device.name);
  const rename = useMutation({
    mutationFn: () => devicesApi.rename(device.id, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: devicesKey });
      toast.success('Device renamed');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm" title="Rename device">
        <form
          id="rename-device"
          onSubmit={(event) => {
            event.preventDefault();
            rename.mutate();
          }}
        >
          <Field label="Name">
            <Input
              value={name}
              maxLength={60}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        </form>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            form="rename-device"
            loading={rename.isPending}
            disabled={!name.trim()}
          >
            Save name
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeviceRow({
  device,
  onRename,
  onRevoke,
}: {
  device: DeviceDto;
  onRename: () => void;
  onRevoke: () => void;
}) {
  const revoked = Boolean(device.revokedAt);
  const online = !revoked && isOnline(device.lastSeenAt);
  return (
    <li className={cn('flex items-start gap-4 px-5 py-4', revoked && 'opacity-70')}>
      <span
        aria-hidden
        className={cn(
          'mt-2 size-2.5 shrink-0 rounded-full',
          online ? 'bg-success' : revoked ? 'bg-line-strong' : 'bg-ink-subtle',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {device.name}
          {online && <Badge tone="success">Online</Badge>}
          {revoked && <Badge tone="danger">Revoked</Badge>}
        </p>
        <p className="mt-0.5 text-sm text-ink-muted">
          {device.editor === 'vscode' ? 'VS Code' : device.editor} on{' '}
          {platformName(device.platform)}
          {device.extensionVersion ? `, extension ${device.extensionVersion}` : ''}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:flex sm:flex-wrap">
          <div>
            <dt className="sr-only">Last active</dt>
            <dd className="text-ink-muted">
              {revoked
                ? `Revoked ${formatDate(device.revokedAt!)}`
                : device.lastSeenAt
                  ? `Last active ${formatRelative(device.lastSeenAt).toLowerCase()}`
                  : 'Never active'}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Connected</dt>
            <dd className="text-ink-muted">Connected {formatDate(device.createdAt)}</dd>
          </div>
          <div>
            <dt className="sr-only">Coding time</dt>
            <dd className="tabular text-ink-muted">
              {formatDuration(device.totalSeconds)} across {device.sessionCount}{' '}
              {device.sessionCount === 1 ? 'session' : 'sessions'}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Credential</dt>
            <dd>
              <code className="font-mono text-xs text-ink-subtle">{device.credentialPrefix}…</code>
            </dd>
          </div>
        </dl>
      </div>
      {!revoked && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label={`Actions for ${device.name}`} size="sm">
              <MoreHorizontal />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onRename}>
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem tone="danger" onSelect={onRevoke}>
              <ShieldOff />
              Revoke access
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

export function DevicesPage() {
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState<DeviceDto | null>(null);
  const [revoking, setRevoking] = useState<DeviceDto | null>(null);
  const devices = useQuery({
    queryKey: devicesKey,
    queryFn: ({ signal }) => devicesApi.list(signal),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => devicesApi.revoke(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: devicesKey });
      toast.success('Device access revoked');
      setRevoking(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const active = devices.data?.filter((device) => !device.revokedAt) ?? [];
  const revoked = devices.data?.filter((device) => device.revokedAt) ?? [];

  return (
    <>
      <PageHeader
        title="Devices"
        description="Editors connected to your account. Revoking a device stops it syncing immediately."
        actions={<ButtonLink to="/settings/integrations">Connect a device</ButtonLink>}
      />

      {devices.isPending ? (
        <Panel>
          <SkeletonRows rows={3} className="p-5" />
        </Panel>
      ) : devices.isError ? (
        <Panel>
          <ErrorState error={devices.error} onRetry={() => void devices.refetch()} />
        </Panel>
      ) : devices.data.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Laptop />}
            title="No devices connected"
            description="Connect the DevPulse VS Code extension to start tracking your coding time automatically."
            action={<ButtonLink to="/settings/integrations">Connect VS Code</ButtonLink>}
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader
              title="Connected"
              description={`${active.length} ${active.length === 1 ? 'device' : 'devices'}`}
            />
            {active.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-sm text-ink-muted">
                No devices are currently connected.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {active.map((device) => (
                  <DeviceRow
                    key={device.id}
                    device={device}
                    onRename={() => setRenaming(device)}
                    onRevoke={() => setRevoking(device)}
                  />
                ))}
              </ul>
            )}
          </Panel>
          {revoked.length > 0 && (
            <Panel>
              <PanelHeader
                title="Revoked"
                description="Kept so past sessions stay attributed to the right machine."
              />
              <ul className="mt-3 divide-y divide-line">
                {revoked.map((device) => (
                  <DeviceRow
                    key={device.id}
                    device={device}
                    onRename={() => undefined}
                    onRevoke={() => undefined}
                  />
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      {renaming && <RenameDialog device={renaming} onClose={() => setRenaming(null)} />}
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={`Revoke ${revoking?.name ?? 'this device'}?`}
        description="The extension on this device will stop syncing immediately. Its past sessions are kept. You can connect it again with a new key."
        confirmLabel="Revoke access"
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
      />
    </>
  );
}
