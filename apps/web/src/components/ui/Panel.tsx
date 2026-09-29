import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** The primary content container. Bordered, never shadowed: elevation is reserved for floating layers. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('rounded-panel border border-line bg-surface', className)} {...props} />
  );
}

interface PanelHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
  as: Heading = 'h2',
}: PanelHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        <Heading className="text-base font-semibold">{title}</Heading>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PanelBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}
