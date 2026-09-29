import { NavLink } from 'react-router';
import { Logo } from '@/components/Logo';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/cn';
import { MAIN_NAV, SECONDARY_NAV, type NavItem } from './nav-items';

function SidebarLink({
  item,
  compact,
  onNavigate,
}: {
  item: NavItem;
  compact: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      aria-label={compact ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors',
          compact && 'justify-center px-0',
          isActive
            ? 'bg-accent-soft text-accent-ink'
            : 'text-ink-muted hover:bg-surface-3 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden
              className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-accent"
            />
          )}
          <Icon className="size-[18px] shrink-0" aria-hidden />
          {!compact && <span>{item.label}</span>}
        </>
      )}
    </NavLink>
  );
  return compact ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

interface SidebarNavProps {
  compact?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ compact = false, onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
      {MAIN_NAV.map((item) => (
        <SidebarLink key={item.to} item={item} compact={compact} onNavigate={onNavigate} />
      ))}
      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
        {SECONDARY_NAV.map((item) => (
          <SidebarLink key={item.to} item={item} compact={compact} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

/** Desktop: full sidebar. Tablet: icon rail. Hidden on mobile (drawer is used instead). */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex md:w-[72px] lg:w-60">
      <div className="mb-6 flex h-10 items-center px-2 max-lg:justify-center max-lg:px-0">
        <span className="lg:hidden">
          <Logo showWordmark={false} />
        </span>
        <span className="hidden lg:inline-flex">
          <Logo />
        </span>
      </div>
      <div className="flex flex-1 flex-col lg:hidden">
        <SidebarNav compact />
      </div>
      <div className="hidden flex-1 flex-col lg:flex">
        <SidebarNav />
      </div>
    </aside>
  );
}
