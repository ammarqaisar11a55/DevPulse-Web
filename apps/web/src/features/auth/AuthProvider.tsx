import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, UserDto } from '@devpulse/shared';
import { ApiError, configureAuthHandlers, refreshAccessToken, tokenStore } from '@/lib/api-client';
import { authApi } from './auth-api';
import { AuthContext, type AuthStatus } from './auth-context';

/*
 * A non-secret hint that this browser has signed in before. It lets anonymous visitors skip
 * the refresh round-trip (and its expected 401) on first load.
 */
const SESSION_HINT_KEY = 'devpulse:has-session';

function readHint() {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHint(active: boolean) {
  try {
    if (active) localStorage.setItem(SESSION_HINT_KEY, '1');
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Storage unavailable: the app still works, it just always attempts a refresh.
  }
}

let bootstrap: Promise<AuthResponse | null> | null = null;

const RETRY_DELAYS_MS = [500, 1500];

/**
 * Refreshes the session, retrying transient failures (network errors, 5xx during a deploy).
 * Only an explicit 401/403 means the session is gone.
 */
async function refreshWithRetry(): Promise<AuthResponse | null> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await authApi.refresh();
    } catch (error) {
      const definitive =
        error instanceof ApiError && (error.status === 401 || error.status === 403);
      const delay = RETRY_DELAYS_MS[attempt];
      if (definitive || delay === undefined) return null;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>(() =>
    readHint() ? 'loading' : 'unauthenticated',
  );
  const [user, setUser] = useState<UserDto | null>(null);

  const clearSession = useCallback(() => {
    tokenStore.set(null);
    writeHint(false);
    setUser(null);
    setStatus('unauthenticated');
    queryClient.clear();
  }, [queryClient]);

  const acceptSession = useCallback((response: AuthResponse) => {
    tokenStore.set(response.accessToken);
    writeHint(true);
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    configureAuthHandlers({
      refresh: async () => {
        const response = await refreshWithRetry();
        if (!response) return null;
        acceptSession(response);
        return response.accessToken;
      },
      onUnauthorized: clearSession,
    });
  }, [acceptSession, clearSession]);

  // Restore the session on first load (deduplicated across StrictMode double effects).
  useEffect(() => {
    if (!readHint()) return;
    bootstrap ??= refreshAccessToken().then(() => null);
    void bootstrap.then(() => {
      if (!tokenStore.get()) clearSession();
    });
  }, [clearSession]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      bootstrap = null;
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ status, user, acceptSession, setUser, logout, clearSession }),
    [status, user, acceptSession, logout, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
