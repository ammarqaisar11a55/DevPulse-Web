import { UserMenu } from '@/features/auth/UserMenu';
import { AppShell } from './AppShell';

/** The signed-in application frame: shell plus account-aware top bar controls. */
export function AuthenticatedLayout() {
  return <AppShell userMenu={<UserMenu />} />;
}
