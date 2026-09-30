import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/Logo';
import { PulseWeekPreview } from '@/components/pulse/PulseWeekPreview';
import { ThemeToggle } from '@/features/theme/ThemeToggle';

interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="DevPulse home">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-semibold">{title}</h1>
          {description && <p className="mt-2 text-ink-muted">{description}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-ink-muted">{footer}</div>}
        </main>
      </div>

      <aside className="relative hidden flex-col justify-center overflow-hidden border-l border-line bg-surface px-12 xl:px-20 lg:flex">
        <div className="max-w-xl">
          <p className="font-display text-[2.5rem] leading-[1.05] font-semibold tracking-tight">
            A week of focus,
            <br />
            drawn as a pulse.
          </p>
          <p className="mt-4 max-w-md text-ink-muted">
            DevPulse records when you code, on which project and in which language. Never your
            source code.
          </p>
          <PulseWeekPreview className="mt-10" />
        </div>
      </aside>
    </div>
  );
}
