import { Link } from 'react-router';
import { Logo } from '@/components/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/auth-context';
import { ThemeToggle } from '@/features/theme/ThemeToggle';

const SECTIONS = [
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#privacy', label: 'Privacy' },
];

export function LandingHeader() {
  const { status } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" aria-label="DevPulse home">
          <Logo />
        </Link>
        <nav aria-label="Sections" className="hidden gap-6 text-sm text-ink-muted md:flex">
          {SECTIONS.map((section) => (
            <a key={section.href} href={section.href} className="hover:text-ink">
              {section.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {status === 'authenticated' ? (
            <ButtonLink to="/dashboard" size="sm">
              Open dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm" className="max-sm:hidden">
                Sign in
              </ButtonLink>
              <ButtonLink to="/register" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
