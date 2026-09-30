import {
  addDays,
  calendarBoundaries,
  formatLocalDate,
  minutesIntoLocalDay,
  parseLocalDate,
  startOfLocalDay,
  toLocalDate,
} from '@devpulse/shared/time';

/** Calendar date key (YYYY-MM-DD) of an instant in the user's time zone. */
export function localDateKey(value: string | Date, timeZone: string) {
  return formatLocalDate(toLocalDate(new Date(value), timeZone));
}

export function minutesOfDay(value: string | Date, timeZone: string) {
  return minutesIntoLocalDay(new Date(value), timeZone);
}

/** "Today", "Yesterday", or a weekday and date, for grouping headers. */
export function dayLabel(dateKey: string, timeZone: string, now = new Date()) {
  const today = toLocalDate(now, timeZone);
  if (dateKey === formatLocalDate(today)) return 'Today';
  if (dateKey === formatLocalDate(addDays(today, -1))) return 'Yesterday';
  const date = parseLocalDate(dateKey);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(date.year !== today.year ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)));
}

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'all' | 'custom';

export const RANGE_LABELS: Record<Exclude<RangePreset, 'custom'>, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
};

/**
 * Converts a range preset (or custom YYYY-MM-DD bounds, inclusive) into an instant range in
 * the user's time zone. `to` is exclusive.
 */
export function resolveRange(
  preset: RangePreset,
  timeZone: string,
  custom?: { from?: string | null; to?: string | null },
  now = new Date(),
): { from?: Date; to?: Date } {
  const b = calendarBoundaries(now, timeZone, 1);
  switch (preset) {
    case 'today':
      return { from: b.todayStart, to: b.tomorrowStart };
    case 'yesterday':
      return { from: b.yesterdayStart, to: b.todayStart };
    case '7d':
      return { from: startOfLocalDay(addDays(b.today, -6), timeZone), to: b.tomorrowStart };
    case '30d':
      return { from: startOfLocalDay(addDays(b.today, -29), timeZone), to: b.tomorrowStart };
    case '90d':
      return { from: startOfLocalDay(addDays(b.today, -89), timeZone), to: b.tomorrowStart };
    case 'custom':
      return {
        from: custom?.from ? startOfLocalDay(parseLocalDate(custom.from), timeZone) : undefined,
        to: custom?.to
          ? startOfLocalDay(addDays(parseLocalDate(custom.to), 1), timeZone)
          : undefined,
      };
    default:
      return {};
  }
}
