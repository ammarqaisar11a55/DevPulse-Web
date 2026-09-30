import { NavLink, Outlet } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/cn';
import { SETTINGS_SECTIONS } from './settings-sections';

export function SettingsLayout() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile, appearance and account security."
      />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Settings sections" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-1 border-b border-line lg:flex-col lg:border-0">
            {SETTINGS_SECTIONS.map((section) => (
              <li key={section.to}>
                <NavLink
                  to={section.to}
                  className={({ isActive }) =>
                    cn(
                      'block px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors lg:rounded-control',
                      isActive
                        ? 'border-b-2 border-accent text-ink lg:border-0 lg:bg-surface-3'
                        : 'border-b-2 border-transparent text-ink-muted hover:text-ink lg:border-0 lg:hover:bg-surface-3',
                    )
                  }
                >
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 max-w-3xl flex-col gap-6">
          <Outlet />
        </div>
      </div>
    </>
  );
}
