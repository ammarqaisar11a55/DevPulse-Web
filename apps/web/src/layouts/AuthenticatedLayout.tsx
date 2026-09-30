import { UserMenu } from '@/features/auth/UserMenu';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { SearchCommand } from '@/features/search/SearchCommand';
import { ThemeServerSync } from '@/features/settings/ThemeServerSync';
import { AppShell } from './AppShell';

/** The signed-in application frame: shell plus account-aware top bar controls. */
export function AuthenticatedLayout() {
  return (
    <>
      <ThemeServerSync />
      <AppShell
        search={<SearchCommand />}
        notifications={<NotificationBell />}
        userMenu={<UserMenu />}
      />
    </>
  );
}
