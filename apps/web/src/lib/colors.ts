import type { ProjectColor } from '@devpulse/shared';

const PROJECT_COLOR_VARS: Record<ProjectColor, string> = {
  blue: 'var(--chart-1)',
  teal: 'var(--chart-2)',
  amber: 'var(--chart-3)',
  violet: 'var(--chart-4)',
  magenta: 'var(--chart-5)',
  slate: 'var(--chart-6)',
};

export function projectColor(color: ProjectColor | null | undefined) {
  return PROJECT_COLOR_VARS[color ?? 'slate'];
}

/** Stable colour for an arbitrary series name (languages, devices) from the chart palette. */
export function seriesColor(index: number) {
  return `var(--chart-${(index % 6) + 1})`;
}
