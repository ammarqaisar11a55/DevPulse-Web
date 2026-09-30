import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { deleteAccountSchema, type DeleteAccountInput } from '@devpulse/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { useAuth } from '@/features/auth/auth-context';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { applyServerErrors } from '@/lib/form-errors';
import { settingsApi } from '../settings-api';

export function DeleteAccountPanel() {
  const [open, setOpen] = useState(false);
  const { clearSession } = useAuth();
  const navigate = useNavigate();
  const form = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '', confirmation: '' as 'DELETE' },
  });
  const { errors } = form.formState;

  const remove = useMutation({
    mutationFn: settingsApi.deleteAccount,
    onSuccess: () => {
      clearSession();
      navigate('/', { replace: true });
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, ['password', 'confirmation']);
      if (message) form.setError('root', { message });
    },
  });

  return (
    <Panel className="border-danger/30">
      <PanelHeader
        title="Delete account"
        description="Permanently delete your account, projects, sessions, devices and goals. This cannot be undone."
      />
      <PanelBody>
        <Button variant="secondary" className="text-danger" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </PanelBody>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="sm"
          title="Delete your account?"
          description="All of your DevPulse data will be erased immediately."
        >
          <form
            id="delete-account"
            onSubmit={form.handleSubmit((values) => remove.mutate(values))}
            noValidate
            className="grid gap-4"
          >
            {errors.root?.message && <Alert>{errors.root.message}</Alert>}
            <Field label="Password" error={errors.password?.message}>
              <PasswordInput autoComplete="current-password" {...form.register('password')} />
            </Field>
            <Field label="Type DELETE to confirm" error={errors.confirmation?.message}>
              <Input autoComplete="off" spellCheck={false} {...form.register('confirmation')} />
            </Field>
          </form>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" form="delete-account" variant="danger" loading={remove.isPending}>
              Delete account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
