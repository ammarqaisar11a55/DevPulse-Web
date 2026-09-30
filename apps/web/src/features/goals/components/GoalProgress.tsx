import type { GoalDto } from '@devpulse/shared';
import { cn } from '@/lib/cn';
import { goalTitle, goalValue, periodLabel } from '../goal-format';

/** Progress towards a goal: values as text, with a bar that turns green when complete. */
export function GoalProgress({ goal, compact = false }: { goal: GoalDto; compact?: boolean }) {
  const { current, target, ratio, completed } = goal.progress;
  const percent = Math.round(ratio * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn('min-w-0 truncate font-medium', compact && 'text-sm')}>
          {goalTitle(goal)}
        </p>
        <p className="tabular shrink-0 text-sm text-ink-muted">
          <span className="font-medium text-ink">{goalValue(goal, current)}</span> /{' '}
          {goalValue(goal, target)}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={goalTitle(goal)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
        aria-valuetext={`${percent}% of goal ${periodLabel(goal.period)}`}
        className={cn(
          'mt-2 overflow-hidden rounded-full bg-surface-3',
          compact ? 'h-1.5' : 'h-2.5',
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            completed ? 'bg-success' : 'bg-accent',
          )}
          style={{ width: `${Math.min(100, Math.max(ratio > 0 ? 2 : 0, percent))}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">
        {completed
          ? `Reached ${periodLabel(goal.period)}`
          : `${percent}% complete ${periodLabel(goal.period)}`}
      </p>
    </div>
  );
}
