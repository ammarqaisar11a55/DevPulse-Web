import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { emailChangeKey, settingsApi } from '@/features/settings/settings-api';
import { getErrorMessage } from '@/lib/api-client';
import { useAuth } from '../auth-context';
import { AuthLayout } from '../AuthLayout';

/**
 * Opened from the link sent to a new email address. Confirming takes an explicit click, so mail
 * scanners that open links in advance cannot complete the change on the user's behalf.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { status, setUser } = useAuth();
  const queryClient = useQueryClient();
  const signedIn = status === 'authenticated';

  const confirm = useMutation({
    mutationFn: () => settingsApi.confirmEmailChange(token),
    onSuccess: async () => {
      queryClient.setQueryData(emailChangeKey, null);
      // Refresh the cached profile when this browser is signed in to the account.
      if (signedIn) setUser(await settingsApi.me());
    },
  });

  if (!token) {
    return (
      <AuthLayout
        title="This link is incomplete"
        description="Open the confirmation link from your email again, or start the change again from your settings."
      >
        <ButtonLink to={signedIn ? '/settings/profile' : '/login'} className="w-full">
          {signedIn ? 'Go to settings' : 'Sign in'}
        </ButtonLink>
      </AuthLayout>
    );
  }

  if (confirm.isSuccess) {
    return (
      <AuthLayout
        title="Email address confirmed"
        description={
          <>
            You now sign in with <span className="font-medium text-ink">{confirm.data.email}</span>.
            We let your previous address know about the change.
          </>
        }
      >
        <ButtonLink to={signedIn ? '/settings/profile' : '/login'} className="w-full">
          {signedIn ? 'Back to settings' : 'Sign in'}
        </ButtonLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Confirm your new email"
      description="Confirm to start signing in to DevPulse with this address. Password resets and account emails will go there too."
      footer={
        <Link
          to={signedIn ? '/settings/profile' : '/login'}
          className="font-medium text-accent hover:underline"
        >
          {signedIn ? 'Back to settings' : 'Back to sign in'}
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        {confirm.isError && <Alert>{getErrorMessage(confirm.error)}</Alert>}
        <Button className="w-full" loading={confirm.isPending} onClick={() => confirm.mutate()}>
          Confirm email change
        </Button>
      </div>
    </AuthLayout>
  );
}
