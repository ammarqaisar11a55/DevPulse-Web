import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { emailSchema, usernameSchema } from '@devpulse/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { useAuth, useCurrentUser } from '@/features/auth/auth-context';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { applyServerErrors } from '@/lib/form-errors';
import { settingsApi } from '../settings-api';

const schemas = {
  username: z.object({
    value: usernameSchema,
    currentPassword: z.string().min(1, 'Enter your current password'),
  }),
  email: z.object({
    value: emailSchema,
    currentPassword: z.string().min(1, 'Enter your current password'),
  }),
};

interface IdentityDialogProps {
  field: 'username' | 'email';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IdentityDialog({ field, open, onOpenChange }: IdentityDialogProps) {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const form = useForm<{ value: string; currentPassword: string }>({
    resolver: zodResolver(schemas[field]),
    defaultValues: { value: field === 'email' ? user.email : user.username, currentPassword: '' },
  });
  const { errors } = form.formState;

  const save = useMutation({
    mutationFn: (values: { value: string; currentPassword: string }) =>
      settingsApi.updateIdentity({
        [field]: values.value,
        currentPassword: values.currentPassword,
      }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success(field === 'email' ? 'Email changed' : 'Username changed');
      onOpenChange(false);
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, ['value', 'currentPassword'], {
        [field]: 'value',
      });
      if (message) form.setError('root', { message });
    },
  });

  const label = field === 'email' ? 'New email' : 'New username';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title={field === 'email' ? 'Change email' : 'Change username'}
        description={
          field === 'email'
            ? 'You will sign in with the new address. We will let your current address know about the change.'
            : 'Your username is used to sign in and appears on your profile.'
        }
      >
        <form
          id="identity-form"
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          noValidate
          className="grid gap-4"
        >
          {errors.root?.message && <Alert>{errors.root.message}</Alert>}
          <Field label={label} error={errors.value?.message}>
            <Input
              type={field === 'email' ? 'email' : 'text'}
              autoComplete={field === 'email' ? 'email' : 'username'}
              autoFocus
              {...form.register('value')}
            />
          </Field>
          <Field label="Current password" error={errors.currentPassword?.message}>
            <PasswordInput autoComplete="current-password" {...form.register('currentPassword')} />
          </Field>
        </form>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form="identity-form" loading={save.isPending}>
            {field === 'email' ? 'Change email' : 'Change username'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
