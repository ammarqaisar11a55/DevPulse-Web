import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changePasswordSchema,
  PASSWORD_MIN_LENGTH,
  type ChangePasswordInput,
} from '@devpulse/shared';
import { Monitor } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { authApi } from '@/features/auth/auth-api';
import { useAuth } from '@/features/auth/auth-context';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { getErrorMessage } from '@/lib/api-client';
import { formatRelative } from '@/lib/format';
import { applyServerErrors } from '@/lib/form-errors';
import { describeUserAgent } from '@/lib/user-agent';
import { settingsApi } from '../settings-api';

const SESSIONS_KEY = ['auth', 'sessions'] as const;

function ChangePasswordPanel() {
  const queryClient = useQueryClient();
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const { errors } = form.formState;

  const change = useMutation({
    mutationFn: settingsApi.changePassword,
    onSuccess: () => {
      form.reset();
      toast.success('Password changed. Other devices were signed out.');
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, [
        'currentPassword',
        'newPassword',
        'confirmPassword',
      ]);
      if (message) toast.error(message);
    },
  });

  return (
    <Panel>
      <PanelHeader
        title="Password"
        description="Changing your password signs you out everywhere except this browser."
      />
      <PanelBody>
        <form
          onSubmit={form.handleSubmit((values) => change.mutate(values))}
          noValidate
          className="grid gap-4 sm:max-w-md"
        >
          <Field label="Current password" error={errors.currentPassword?.message}>
            <PasswordInput autoComplete="current-password" {...form.register('currentPassword')} />
          </Field>
          <Field
            label="New password"
            error={errors.newPassword?.message}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number or symbol.`}
          >
            <PasswordInput autoComplete="new-password" {...form.register('newPassword')} />
          </Field>
          <Field label="Confirm new password" error={errors.confirmPassword?.message}>
            <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
          </Field>
          <div>
            <Button type="submit" loading={change.isPending}>
              Change password
            </Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

function ActiveSessionsPanel() {
  const queryClient = useQueryClient();
  const { clearSession } = useAuth();
  const navigate = useNavigate();
  const [confirmAll, setConfirmAll] = useState(false);
  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: authApi.sessions });

  const revoke = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => {
      toast.success('Session signed out');
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const logoutAll = useMutation({
    mutationFn: authApi.logoutAll,
    onSuccess: () => {
      clearSession();
      navigate('/login', { replace: true });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Panel>
      <PanelHeader
        title="Active sessions"
        description="Browsers currently signed in to your account."
        actions={
          <Button variant="secondary" size="sm" onClick={() => setConfirmAll(true)}>
            Sign out everywhere
          </Button>
        }
      />
      <PanelBody>
        {sessions.isPending ? (
          <SkeletonRows rows={2} />
        ) : sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : (
          <ul className="divide-y divide-line">
            {sessions.data.map((session) => (
              <li key={session.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-ink-muted">
                  <Monitor className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {describeUserAgent(session.userAgent)}
                    {session.current && <Badge tone="success">This browser</Badge>}
                  </p>
                  <p className="text-sm text-ink-muted">
                    Active {formatRelative(session.lastUsedAt).toLowerCase()}
                    {session.ipAddress ? `, from ${session.ipAddress}` : ''}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={revoke.isPending && revoke.variables === session.id}
                    onClick={() => revoke.mutate(session.id)}
                  >
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sign out everywhere?"
        description="Every browser, including this one, will need to sign in again. Paired editors are managed separately under Devices."
        confirmLabel="Sign out everywhere"
        loading={logoutAll.isPending}
        onConfirm={() => logoutAll.mutate()}
      />
    </Panel>
  );
}

export function SecuritySettingsPage() {
  return (
    <>
      <ChangePasswordPanel />
      <ActiveSessionsPanel />
    </>
  );
}
