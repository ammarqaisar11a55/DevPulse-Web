/** Maps a block's active share to a step on the pulse intensity ramp. */
export function intensityColor(activeRatio: number) {
  if (activeRatio >= 0.85) return 'var(--pulse-4)';
  if (activeRatio >= 0.65) return 'var(--pulse-3)';
  if (activeRatio >= 0.4) return 'var(--pulse-2)';
  return 'var(--pulse-1)';
}
