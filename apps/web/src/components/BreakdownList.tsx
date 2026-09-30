import { ColorDot } from '@/components/ui/Badge';
import { formatDuration } from '@/lib/format';
import type { SeriesItem } from '@/lib/series';
import { ShareBar } from './ShareBar';

/**
 * Ranked list of labelled durations with share bars. Identity is carried by the label and a
 * colour dot; percentages are shown as text so nothing depends on colour alone.
 */
export function BreakdownList({ items, empty }: { items: SeriesItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>;
  const total = items.reduce((sum, item) => sum + item.seconds, 0);
  const max = Math.max(...items.map((item) => item.seconds));
  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((item) => (
        <li key={item.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <ColorDot color={item.color} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="tabular shrink-0 text-ink-muted">
              {formatDuration(item.seconds)}
              <span className="ml-2 inline-block w-9 text-right text-ink-subtle">
                {total > 0 ? Math.round((item.seconds / total) * 100) : 0}%
              </span>
            </span>
          </div>
          <ShareBar ratio={max > 0 ? item.seconds / max : 0} color={item.color} />
        </li>
      ))}
    </ul>
  );
}
