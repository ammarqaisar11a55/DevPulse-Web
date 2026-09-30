import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@devpulse/shared';
import { MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { getErrorMessage } from '@/lib/api-client';
import { authApi } from '../auth-api';
import { AuthLayout } from '../AuthLayout';

export function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  const request = useMutation({ mutationFn: authApi.forgotPassword });

  if (request.isSuccess) {
    return (
      <AuthLayout
        title="Check your email"
        description={`If an account exists for ${form.getValues('email')}, we sent a link to reset the password.`}
      >
        <div className="flex items-start gap-3 rounded-panel border border-line bg-surface p-4 text-sm text-ink-muted">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <p>
            The link expires shortly and works once. Check your spam folder if it does not arrive
            within a few minutes.
          </p>
        </div>
        <ButtonLink to="/login" variant="secondary" className="mt-6 w-full">
          Back to sign in
        </ButtonLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter the email you signed up with and we will send you a reset link."
      footer={
        <Link to="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form
        onSubmit={form.handleSubmit((values) => request.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        {request.isError && <Alert>{getErrorMessage(request.error)}</Alert>}
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus {...form.register('email')} />
        </Field>
        <Button type="submit" size="lg" loading={request.isPending} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
