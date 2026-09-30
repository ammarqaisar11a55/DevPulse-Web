const MINUTE = 60;
const HOUR = 60 * MINUTE;

/** 16320 → "4h 32m"; 540 → "9m"; 20 → "<1m". */
export function formatDuration(totalSeconds: number, options: { compact?: boolean } = {}) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < MINUTE) return seconds === 0 ? '0m' : '<1m';
  const hours = Math.floor(seconds / HOUR);
  const minutes = Math.floor((seconds % HOUR) / MINUTE);
  if (hours === 0) return `${minutes}m`;
  if (options.compact && minutes === 0) return `${hours}h`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/** Hours with one decimal for chart axes: 5400 → "1.5h". */
export function formatHours(totalSeconds: number) {
  const hours = totalSeconds / HOUR;
  return `${hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10}h`;
}

export function formatDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  timeZone?: string,
) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(new Date(value));
}

export function formatTime(value: string | Date, timeZone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value));
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "Just now", "5 minutes ago", "yesterday", "3 days ago", then an absolute date. */
export function formatRelative(value: string | Date, now = new Date()) {
  const diffSeconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 45) return 'Just now';
  if (abs < HOUR) return relativeFormatter.format(Math.round(diffSeconds / MINUTE), 'minute');
  if (abs < 24 * HOUR) return relativeFormatter.format(Math.round(diffSeconds / HOUR), 'hour');
  if (abs < 7 * 24 * HOUR)
    return relativeFormatter.format(Math.round(diffSeconds / (24 * HOUR)), 'day');
  return formatDate(value);
}

export function formatPercent(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

/** Signed percentage change, or null when there is no baseline to compare against. */
export function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}
