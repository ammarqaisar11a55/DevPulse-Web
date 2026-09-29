import * as RadixDialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { Logo } from '@/components/Logo';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { MAIN_NAV } from './nav-items';
import { SidebarNav } from './Sidebar';

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger asChild>
        <IconButton aria-label="Open navigation" className="md:hidden">
          <Menu />
        </IconButton>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface px-3 py-4 data-[state=open]:animate-slide-in-left"
        >
          <div className="mb-6 flex items-center justify-between px-2">
            <RadixDialog.Title asChild>
              <span>
                <Logo />
              </span>
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <IconButton aria-label="Close navigation" size="sm">
                <X />
              </IconButton>
            </RadixDialog.Close>
          </div>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function MobileBottomNav() {
  const items = MAIN_NAV.filter((item) => item.primary);
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium',
              isActive ? 'text-accent' : 'text-ink-muted',
            )
          }
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
