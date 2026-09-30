import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/auth-context';
import { getErrorMessage } from '@/lib/api-client';
import { settingsApi } from './settings-api';

/** Saves user settings and keeps the cached user in sync. */
export function useUpdateSettings(options: { successMessage?: string } = {}) {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: settingsApi.updateSettings,
    onSuccess: (user) => {
      setUser(user);
      if (options.successMessage) toast.success(options.successMessage);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Your settings could not be saved.')),
  });
}
