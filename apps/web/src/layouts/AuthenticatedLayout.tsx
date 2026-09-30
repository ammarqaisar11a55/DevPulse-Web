import { UserMenu } from '@/features/auth/UserMenu';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { ThemeServerSync } from '@/features/settings/ThemeServerSync';
import { AppShell } from './AppShell';

/** The signed-in application frame: shell plus account-aware top bar controls. */
export function AuthenticatedLayout() {
  return (
    <>
      <ThemeServerSync />
      <AppShell notifications={<NotificationBell />} userMenu={<UserMenu />} />
    </>
  );
}
