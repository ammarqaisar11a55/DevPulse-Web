import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  PASSWORD_MIN_LENGTH,
  resetPasswordSchema,
  type ResetPasswordInput,
} from '@devpulse/shared';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { getErrorMessage } from '@/lib/api-client';
import { authApi } from '../auth-api';
import { AuthLayout } from '../AuthLayout';
import { PasswordInput } from '../PasswordInput';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });
  const { errors } = form.formState;
  const reset = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => navigate('/login?reset=1', { replace: true }),
  });

  if (!token) {
    return (
      <AuthLayout
        title="This link is incomplete"
        description="Open the reset link from your email again, or request a new one."
      >
        <ButtonLink to="/forgot-password" className="w-full">
          Request a new link
        </ButtonLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      description="Signing in with the new password will be required on every device."
      footer={
        <Link to="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form
        onSubmit={form.handleSubmit((values) => reset.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        {reset.isError && (
          <Alert>
            {getErrorMessage(reset.error)}{' '}
            <Link to="/forgot-password" className="font-medium underline">
              Request a new link
            </Link>
          </Alert>
        )}
        {errors.token && <Alert>{errors.token.message}</Alert>}
        <Field
          label="New password"
          error={errors.password?.message}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number or symbol.`}
        >
          <PasswordInput autoComplete="new-password" autoFocus {...form.register('password')} />
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword?.message}>
          <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
        </Field>
        <Button type="submit" size="lg" loading={reset.isPending} className="w-full">
          Set new password
        </Button>
      </form>
    </AuthLayout>
  );
}
