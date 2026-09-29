import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { MobileNavDrawer } from './MobileNav';

interface TopbarProps {
  search?: ReactNode;
  notifications?: ReactNode;
  userMenu?: ReactNode;
}

export function Topbar({ search, notifications, userMenu }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-6">
      <MobileNavDrawer />
      <span className="md:hidden">
        <Logo showWordmark={false} />
      </span>
      <div className="flex min-w-0 flex-1 items-center">{search}</div>
      <div className="flex items-center gap-1">
        {notifications}
        <ThemeToggle />
        {userMenu}
      </div>
    </header>
  );
}
