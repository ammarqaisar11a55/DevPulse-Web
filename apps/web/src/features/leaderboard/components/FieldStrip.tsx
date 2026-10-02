import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';

export interface FieldMarker {
  key: string;
  seconds: number;
  isCurrentUser: boolean;
}

/**
 * Every participant as a tick on one track from zero to the leader's time, with the current user
 * as a labelled marker. Shows the spread of the field and where you sit in it at a glance.
 */
export function FieldStrip({
  markers,
  mySeconds,
  showMe,
}: {
  markers: FieldMarker[];
  mySeconds: number;
  /** Draws the "you" marker even when the user is not in `markers` (e.g. ranked below the list). */
  showMe: boolean;
}) {
  // Markers start at zero and glide to their positions: the page's one moment of motion.
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const others = markers.filter((marker) => !marker.isCurrentUser);
  const max = Math.max(1, mySeconds, ...markers.map((marker) => marker.seconds));
  const position = (seconds: number) => (placed ? (seconds / max) * 100 : 0);
  const mine = position(mySeconds);
  // Keep the label inside the track near either end.
  const labelAlign = mine > 80 ? 'right' : mine < 12 ? 'left' : 'center';

  return (
    <div
      role="img"
      aria-label={`${markers.length} developers ranked. The leader has ${formatDuration(max)}${showMe ? `; you have ${formatDuration(mySeconds)}` : ''}.`}
    >
      <div className="relative h-16">
        <div aria-hidden className="absolute inset-x-0 top-11 h-px bg-line-strong" />
        {others.map((marker) => (
          <span
            key={marker.key}
            aria-hidden
            className="absolute top-[2.375rem] h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-pulse-2 transition-[left] duration-700 ease-out motion-reduce:transition-none"
            style={{ left: `${position(marker.seconds)}%` }}
          />
        ))}
        {showMe && (
          <div
            aria-hidden
            className="absolute top-0 h-full transition-[left] duration-700 ease-out motion-reduce:transition-none"
            style={{ left: `${mine}%` }}
          >
            <span
              className={cn(
                'absolute top-0 text-xs font-semibold whitespace-nowrap text-accent-ink',
                labelAlign === 'center' && '-translate-x-1/2',
                labelAlign === 'right' && '-translate-x-full',
              )}
            >
              You, {formatDuration(mySeconds)}
            </span>
            <span className="absolute top-5 h-4 w-px -translate-x-1/2 bg-accent" />
            <span className="absolute top-[2.375rem] size-3.5 -translate-x-1/2 rounded-full bg-accent ring-4 ring-surface" />
          </div>
        )}
      </div>
      <div aria-hidden className="tabular flex justify-between text-xs text-ink-muted">
        <span>0h</span>
        <span>{formatDuration(max)}</span>
      </div>
    </div>
  );
}
