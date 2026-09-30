import { useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePreference } from '@/features/theme/theme-storage';
import { settingsApi } from './settings-api';

const toServer = (preference: ThemePreference) =>
  preference.toUpperCase() as 'LIGHT' | 'DARK' | 'SYSTEM';
const fromServer = (theme: 'LIGHT' | 'DARK' | 'SYSTEM') => theme.toLowerCase() as ThemePreference;

/**
 * Keeps the theme consistent across browsers. On sign-in, an explicit Light/Dark choice saved
 * on the account is applied locally; the account default (System) never overrides an explicit
 * local choice, which is saved to the account instead. Later local changes (navbar toggle,
 * settings page) are saved to the account.
 */
export function ThemeServerSync() {
  const { user, setUser } = useAuth();
  const { preference, setPreference } = useTheme();
  const appliedForUser = useRef<string | null>(null);

  const serverTheme = user?.settings.theme;
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !serverTheme || appliedForUser.current === userId) return;
    appliedForUser.current = userId;
    if (serverTheme !== 'SYSTEM' && fromServer(serverTheme) !== preference)
      setPreference(fromServer(serverTheme));
    // Only runs when a user first becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId || appliedForUser.current !== userId || !serverTheme) return;
    if (toServer(preference) === serverTheme) return;
    let cancelled = false;
    settingsApi
      .updateSettings({ theme: toServer(preference) })
      .then((updated) => {
        if (!cancelled) setUser(updated);
      })
      .catch(() => {
        // Non-critical: the local preference still applies; it will sync on the next change.
      });
    return () => {
      cancelled = true;
    };
  }, [preference, serverTheme, userId, setUser]);

  return null;
}
