import { createContext, useContext } from 'react';
import type { AuthResponse, UserDto } from '@devpulse/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  /** Stores a freshly issued session (after login or registration). */
  acceptSession: (response: AuthResponse) => void;
  /** Replaces the cached user after profile or settings changes. */
  setUser: (user: UserDto) => void;
  logout: () => Promise<void>;
  /** Clears local auth state after the server has revoked the session. */
  clearSession: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** For components that only render inside authenticated routes. */
export function useCurrentUser() {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser called without an authenticated user');
  return user;
}
