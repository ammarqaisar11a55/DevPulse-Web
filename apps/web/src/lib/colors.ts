import type { ProjectColor } from '@devpulse/shared';

const PROJECT_COLOR_VARS: Record<ProjectColor, string> = {
  blue: 'var(--chart-1)',
  teal: 'var(--chart-2)',
  violet: 'var(--chart-3)',
  amber: 'var(--chart-4)',
  magenta: 'var(--chart-5)',
  orange: 'var(--chart-6)',
};

export const OTHER_SERIES_COLOR = 'var(--chart-other)';

/** Colour for a project; unknown or missing colours use the neutral "other" tone. */
export function projectColor(color: string | null | undefined) {
  return (color && PROJECT_COLOR_VARS[color as ProjectColor]) || OTHER_SERIES_COLOR;
}

/** Categorical slots in fixed order. */
export const MAX_SERIES = 6;

/**
 * Colour for the series at `index` in a fixed-order list. Series beyond the palette must be
 * folded into "Other" by the caller rather than recycling hues.
 */
export function seriesColor(index: number) {
  return index < MAX_SERIES ? `var(--chart-${index + 1})` : OTHER_SERIES_COLOR;
}
