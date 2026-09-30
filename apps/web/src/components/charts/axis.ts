/** Shared, recessive axis styling for Recharts. */
export const AXIS_TICK = { fill: 'var(--chart-axis)', fontSize: 12 } as const;
export const GRID_STROKE = 'var(--chart-grid)';
/** Rounded data end anchored to the baseline (top corners only). */
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

/** "2h", "30m" ticks for a seconds axis. */
export function hoursTick(seconds: number) {
  if (seconds === 0) return '0';
  const hours = seconds / 3600;
  return hours >= 1 ? `${Math.round(hours * 10) / 10}h` : `${Math.round(seconds / 60)}m`;
}

/** Tick values in whole hours (or half hours for small ranges) up to the data maximum. */
export function hourTicks(maxSeconds: number) {
  const maxHours = maxSeconds / 3600;
  const step =
    maxHours <= 2 ? 0.5 : maxHours <= 6 ? 1 : maxHours <= 12 ? 2 : Math.ceil(maxHours / 5);
  const top = Math.max(step, Math.ceil(maxHours / step) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= top + 1e-9; value += step) ticks.push(Math.round(value * 3600));
  return ticks;
}
