import { cn } from '@/lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-7', className)}>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M5 17h5l2.5-6 4 11 3-8 1.5 3H27"
        fill="none"
        stroke="var(--ink-inverse)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showWordmark && (
        <span className="font-display text-lg font-semibold tracking-tight">DevPulse</span>
      )}
    </span>
  );
}
