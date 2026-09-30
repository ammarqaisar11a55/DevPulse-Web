import { cn } from '@/lib/cn';
import { intensityColor } from './pulse-colors';

export interface PulseBlock {
  id: string;
  /** Minutes since local midnight. */
  startMinute: number;
  endMinute: number;
  /** Share of the block spent actively coding, 0–1. Drives colour intensity. */
  activeRatio: number;
  label: string;
}

const MINUTES_PER_DAY = 24 * 60;

interface PulseStripProps {
  blocks: PulseBlock[];
  /** Minute of the day to mark as "now". */
  nowMinute?: number;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Accessible summary. When omitted the strip is treated as decorative. */
  label?: string;
  onBlockClick?: (block: PulseBlock) => void;
}

const heights = { sm: 'h-3', md: 'h-6', lg: 'h-10' };

/**
 * A 24-hour ribbon showing when coding happened. Each block is a session; stronger blue
 * means more of it was active rather than idle.
 */
export function PulseStrip({
  blocks,
  nowMinute,
  height = 'md',
  className,
  label,
  onBlockClick,
}: PulseStripProps) {
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'relative w-full overflow-hidden rounded-md bg-pulse-0',
        heights[height],
        className,
      )}
    >
      {[6, 12, 18].map((hour) => (
        <span
          key={hour}
          aria-hidden
          className="absolute inset-y-0 w-px bg-line opacity-70"
          style={{ left: `${(hour / 24) * 100}%` }}
        />
      ))}
      {blocks.map((block) => {
        const start = Math.max(0, Math.min(MINUTES_PER_DAY, block.startMinute));
        const end = Math.max(start + 4, Math.min(MINUTES_PER_DAY, block.endMinute));
        const style = {
          left: `${(start / MINUTES_PER_DAY) * 100}%`,
          width: `${((end - start) / MINUTES_PER_DAY) * 100}%`,
          backgroundColor: intensityColor(block.activeRatio),
        };
        return onBlockClick ? (
          <button
            key={block.id}
            type="button"
            title={block.label}
            aria-label={block.label}
            onClick={() => onBlockClick(block)}
            className="absolute inset-y-0 rounded-[3px] transition-[filter] hover:brightness-110 focus-visible:z-10"
            style={style}
          />
        ) : (
          <span
            key={block.id}
            title={block.label}
            className="absolute inset-y-0 rounded-[3px]"
            style={style}
          />
        );
      })}
      {nowMinute !== undefined && (
        <span
          aria-hidden
          className="absolute -inset-y-px w-0.5 rounded-full bg-amber"
          style={{ left: `${(nowMinute / MINUTES_PER_DAY) * 100}%` }}
        />
      )}
    </div>
  );
}

export function PulseAxis({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('relative h-4 text-[11px] text-ink-subtle tabular', className)}>
      {[0, 6, 12, 18, 24].map((hour) => (
        <span
          key={hour}
          className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
          style={{ left: `${(hour / 24) * 100}%` }}
        >
          {String(hour).padStart(2, '0')}:00
        </span>
      ))}
    </div>
  );
}
