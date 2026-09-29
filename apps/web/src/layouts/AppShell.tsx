import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { MobileBottomNav } from './shell/MobileNav';
import { Sidebar } from './shell/Sidebar';
import { Topbar } from './shell/Topbar';

interface AppShellProps {
  search?: ReactNode;
  notifications?: ReactNode;
  userMenu?: ReactNode;
  /** Rendered instead of the router outlet when provided. */
  children?: ReactNode;
}

export function AppShell({ children, ...slots }: AppShellProps) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-accent px-4 py-2 text-ink-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar {...slots} />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1320px] flex-1 px-4 pt-6 pb-24 outline-none sm:px-6 md:pb-10 lg:px-8"
        >
          {children ?? <Outlet />}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
