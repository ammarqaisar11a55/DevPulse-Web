import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { updateProfileSchema, type UpdateProfileInput } from '@devpulse/shared';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { useAuth, useCurrentUser } from '@/features/auth/auth-context';
import { formatDate } from '@/lib/format';
import { applyServerErrors } from '@/lib/form-errors';
import { DeleteAccountPanel } from '../components/DeleteAccountPanel';
import { IdentityDialog } from '../components/IdentityDialog';
import { settingsApi } from '../settings-api';
import { browserTimeZone, listTimeZones } from '../timezones';

const FIELDS = ['fullName', 'bio', 'timezone', 'avatarUrl'] as const;

function ProfileForm() {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const timeZones = useMemo(listTimeZones, []);
  const detectedZone = browserTimeZone();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: user.fullName,
      bio: user.bio ?? '',
      timezone: user.timezone,
      avatarUrl: user.avatarUrl ?? '',
    },
  });
  const { errors, isDirty } = form.formState;
  const avatarPreview = form.watch('avatarUrl');

  const save = useMutation({
    mutationFn: settingsApi.updateProfile,
    onSuccess: (updated) => {
      setUser(updated);
      form.reset({
        fullName: updated.fullName,
        bio: updated.bio ?? '',
        timezone: updated.timezone,
        avatarUrl: updated.avatarUrl ?? '',
      });
      toast.success('Profile saved');
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, FIELDS);
      if (message) toast.error(message);
    },
  });

  return (
    <Panel>
      <PanelHeader title="Profile" description="How you appear in DevPulse." />
      <PanelBody>
        <form
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          noValidate
          className="grid gap-5"
        >
          <div className="flex items-center gap-4">
            <Avatar
              name={user.fullName}
              src={avatarPreview && /^https:\/\//.test(avatarPreview) ? avatarPreview : null}
              size="lg"
            />
            <Field
              label="Avatar URL"
              optional
              error={errors.avatarUrl?.message}
              hint="Link to a square image hosted over https."
              className="flex-1"
            >
              <Input type="url" placeholder="https://" {...form.register('avatarUrl')} />
            </Field>
          </div>
          <Field label="Full name" error={errors.fullName?.message}>
            <Input autoComplete="name" {...form.register('fullName')} />
          </Field>
          <Field label="Bio" optional error={errors.bio?.message}>
            <Textarea
              rows={3}
              maxLength={280}
              placeholder="What do you work on?"
              {...form.register('bio')}
            />
          </Field>
          <Field
            label="Time zone"
            error={errors.timezone?.message}
            hint="Daily totals and goals reset at midnight in this time zone."
            labelAction={
              detectedZone && detectedZone !== form.watch('timezone') ? (
                <button
                  type="button"
                  className="text-sm text-accent hover:underline"
                  onClick={() => form.setValue('timezone', detectedZone, { shouldDirty: true })}
                >
                  Use {detectedZone}
                </button>
              ) : undefined
            }
          >
            <Select {...form.register('timezone')}>
              {timeZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending} disabled={!isDirty}>
              Save profile
            </Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

function AccountPanel() {
  const user = useCurrentUser();
  const [dialog, setDialog] = useState<'username' | 'email' | null>(null);

  return (
    <Panel>
      <PanelHeader
        title="Sign-in details"
        description="Changing these requires your current password."
      />
      <PanelBody>
        <dl className="divide-y divide-line">
          {(
            [
              ['username', 'Username', `@${user.username}`],
              ['email', 'Email', user.email],
            ] as const
          ).map(([key, label, value]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0">
              <div className="min-w-0">
                <dt className="text-sm text-ink-muted">{label}</dt>
                <dd className="truncate font-medium">{value}</dd>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setDialog(key)}>
                Change
              </Button>
            </div>
          ))}
          <div className="py-3 last:pb-0">
            <dt className="text-sm text-ink-muted">Member since</dt>
            <dd className="font-medium">{formatDate(user.createdAt, { dateStyle: 'long' })}</dd>
          </div>
        </dl>
      </PanelBody>
      {dialog && (
        <IdentityDialog field={dialog} open onOpenChange={(open) => !open && setDialog(null)} />
      )}
    </Panel>
  );
}

export function ProfileSettingsPage() {
  return (
    <>
      <ProfileForm />
      <AccountPanel />
      <DeleteAccountPanel />
    </>
  );
}
