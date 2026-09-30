import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from './ui/Skeleton';

export interface Stat {
  label: string;
  value: ReactNode;
  /** Relative change vs the previous period, e.g. 0.12 for +12%. */
  change?: number | null;
  changeLabel?: string;
  hint?: ReactNode;
}

function Trend({ change, label }: { change: number; label?: string }) {
  if (Math.round(change * 100) === 0) {
    return <p className="mt-1.5 text-xs text-ink-muted">About the same {label}</p>;
  }
  const up = change > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const percent = `${up ? '+' : ''}${Math.round(change * 100)}%`;
  return (
    <p
      className={cn(
        'mt-1.5 flex items-center gap-1 text-xs font-medium',
        up ? 'text-success' : 'text-ink-muted',
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span>
        {percent}
        {label && <span className="font-normal text-ink-muted"> {label}</span>}
      </span>
    </p>
  );
}

/**
 * Key metrics in one segmented panel rather than a row of separate cards:
 * the numbers read as one related set.
 */
export function StatStrip({
  stats,
  loading,
  className,
}: {
  stats: Stat[];
  loading?: boolean;
  className?: string;
}) {
  return (
    <dl
      style={{ '--cols': stats.length } as React.CSSProperties}
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-panel border border-line bg-surface lg:grid-cols-[repeat(var(--cols),minmax(0,1fr))]',
        '[&>div]:border-line max-lg:[&>div:nth-child(odd)]:border-r max-lg:[&>div:nth-child(-n+2)]:border-b lg:[&>div:not(:last-child)]:border-r',
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 px-5 py-4">
          <dt className="text-sm text-ink-muted">{stat.label}</dt>
          <dd className="mt-1">
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="tabular font-display text-[1.75rem] leading-none font-semibold tracking-tight">
                {stat.value}
              </span>
            )}
            {!loading && stat.change != null && (
              <Trend change={stat.change} label={stat.changeLabel} />
            )}
            {!loading && stat.change == null && stat.hint && (
              <p className="mt-1.5 text-xs text-ink-muted">{stat.hint}</p>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
