import type { ReactNode } from 'react';

/** Themed tooltip surface for Recharts `content` renderers. Text uses ink tokens, never series colours. */
export function ChartTooltipCard({
  title,
  rows,
}: {
  title: ReactNode;
  rows: { label: ReactNode; value: ReactNode; color?: string }[];
}) {
  return (
    <div className="min-w-36 rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-float">
      <p className="mb-1 font-medium text-ink">{title}</p>
      {rows.map((row, index) => (
        <p key={index} className="flex items-center justify-between gap-4 text-ink-muted">
          <span className="flex items-center gap-1.5">
            {row.color && (
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: row.color }}
              />
            )}
            {row.label}
          </span>
          <span className="tabular font-medium text-ink">{row.value}</span>
        </p>
      ))}
    </div>
  );
}
