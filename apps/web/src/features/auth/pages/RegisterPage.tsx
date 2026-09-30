import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { PASSWORD_MIN_LENGTH, registerSchema, type RegisterInput } from '@devpulse/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { applyServerErrors } from '@/lib/form-errors';
import { authApi } from '../auth-api';
import { useAuth } from '../auth-context';
import { AuthLayout } from '../AuthLayout';
import { PasswordInput } from '../PasswordInput';

const FIELDS = ['fullName', 'username', 'email', 'password', 'confirmPassword'] as const;

export function RegisterPage() {
  const { acceptSession } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { fullName: '', username: '', email: '', password: '', confirmPassword: '' },
  });
  const { errors } = form.formState;

  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: acceptSession,
    onError: (error) => setFormError(applyServerErrors(error, form.setError, FIELDS)),
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    register.mutate(values);
  });

  return (
    <AuthLayout
      title="Create your account"
      description="Start measuring how you code. It takes a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert>{formError}</Alert>}
        <Field label="Full name" error={errors.fullName?.message}>
          <Input autoComplete="name" autoFocus {...form.register('fullName')} />
        </Field>
        <Field
          label="Username"
          error={errors.username?.message}
          hint="Letters, numbers, hyphens and underscores."
        >
          <Input
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            {...form.register('username')}
          />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field
          label="Password"
          error={errors.password?.message}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number or symbol.`}
        >
          <PasswordInput autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
        </Field>
        <Button type="submit" size="lg" loading={register.isPending} className="mt-2 w-full">
          Create account
        </Button>
        <p className="text-xs text-ink-subtle">
          DevPulse stores coding metadata such as durations, languages and project names. It never
          uploads your source code.
        </p>
      </form>
    </AuthLayout>
  );
}
