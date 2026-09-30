import { Link } from 'react-router';
import { Logo } from '@/components/Logo';
import { API_DOCS_URL, DOCS_URL, ISSUES_URL, REPOSITORY_URL } from './links';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Get started', to: '/register' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: DOCS_URL, external: true },
      { label: 'API reference', href: API_DOCS_URL, external: true },
      { label: 'GitHub', href: REPOSITORY_URL, external: true },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Privacy', href: '#privacy' },
      { label: 'Contact', href: ISSUES_URL, external: true },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-ink-muted">
            Coding time analytics for developers who want to understand their habits.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="font-sans text-sm font-semibold">{column.title}</h2>
            <ul className="mt-3 grid gap-2 text-sm text-ink-muted">
              {column.links.map((link) => (
                <li key={link.label}>
                  {'to' in link && link.to ? (
                    <Link to={link.to} className="hover:text-ink">
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="hover:text-ink"
                      {...('external' in link && link.external
                        ? { target: '_blank', rel: 'noreferrer noopener' }
                        : {})}
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-10 text-xs text-ink-subtle sm:px-6">
        © {new Date().getFullYear()} DevPulse
      </p>
    </footer>
  );
}
