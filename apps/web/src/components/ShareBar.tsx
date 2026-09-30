import { cn } from '@/lib/cn';

/** Thin horizontal bar showing a value's share of the largest value in a list. */
export function ShareBar({
  ratio,
  color,
  className,
}: {
  ratio: number;
  color: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%`, backgroundColor: color }}
      />
    </div>
  );
}
