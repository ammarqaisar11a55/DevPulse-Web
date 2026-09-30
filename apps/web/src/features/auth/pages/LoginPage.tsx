import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { loginSchema, type LoginInput } from '@devpulse/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { getErrorMessage } from '@/lib/api-client';
import { authApi } from '../auth-api';
import { useAuth } from '../auth-context';
import { AuthLayout } from '../AuthLayout';
import { PasswordInput } from '../PasswordInput';

export function LoginPage() {
  const { acceptSession } = useAuth();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });
  const { errors } = form.formState;

  const login = useMutation({
    mutationFn: authApi.login,
    // GuestOnly performs the redirect (to ?next= or the dashboard) once the session is set.
    onSuccess: acceptSession,
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    login.mutate(values);
  });

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back. Pick up where you left off."
      footer={
        <>
          New to DevPulse?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {params.get('reset') === '1' && (
        <Alert tone="success" className="mb-5">
          Your password was changed. Sign in with your new password.
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert>{formError}</Alert>}
        <Field label="Email or username" error={errors.identifier?.message}>
          <Input autoComplete="username" autoFocus {...form.register('identifier')} />
        </Field>
        <Field
          label="Password"
          error={errors.password?.message}
          labelAction={
            <Link to="/forgot-password" className="text-sm text-accent hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" {...form.register('password')} />
        </Field>
        <Button type="submit" size="lg" loading={login.isPending} className="mt-2 w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
