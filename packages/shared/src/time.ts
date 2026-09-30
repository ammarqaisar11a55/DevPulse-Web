/**
 * Calendar arithmetic in an arbitrary IANA time zone, without external dependencies.
 * Instants are JS Dates (UTC); "local" values are calendar fields in the given zone.
 */

export interface LocalDate {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let cached = formatters.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, cached);
  }
  return cached;
}

function localParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
  return parts;
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds (e.g. +5h for Asia/Karachi). */
export function timeZoneOffsetMs(instant: Date, timeZone: string) {
  const p = localParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const p = localParts(instant, timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

/** The UTC instant at which the given local calendar day begins in `timeZone`. */
export function startOfLocalDay(date: LocalDate, timeZone: string): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day);
  const offset = timeZoneOffsetMs(new Date(guess), timeZone);
  let result = guess - offset;
  // Correct for a DST transition between the guess and the true local midnight.
  const corrected = timeZoneOffsetMs(new Date(result), timeZone);
  if (corrected !== offset) result = guess - corrected;
  return new Date(result);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const moved = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: LocalDate) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function startOfLocalWeek(date: LocalDate, weekStartsOn: number): LocalDate {
  const diff = (weekday(date) - weekStartsOn + 7) % 7;
  return addDays(date, -diff);
}

export function formatLocalDate(date: LocalDate) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function parseLocalDate(value: string): LocalDate {
  const [year, month, day] = value.split('-').map(Number);
  return { year: year!, month: month!, day: day! };
}

/** Minutes since local midnight for an instant, e.g. 13:30 → 810. */
export function minutesIntoLocalDay(instant: Date, timeZone: string) {
  const offset = timeZoneOffsetMs(instant, timeZone);
  const local = new Date(instant.getTime() + offset);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function diffInDays(from: LocalDate, to: LocalDate) {
  return Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) /
      86_400_000,
  );
}

export interface InstantRange {
  from: Date;
  to: Date;
}

/** Local calendar boundaries for "now" in a user's zone. */
export function calendarBoundaries(now: Date, timeZone: string, weekStartsOn: number) {
  const today = toLocalDate(now, timeZone);
  const weekStart = startOfLocalWeek(today, weekStartsOn);
  const monthStart: LocalDate = { year: today.year, month: today.month, day: 1 };
  return {
    today,
    todayStart: startOfLocalDay(today, timeZone),
    tomorrowStart: startOfLocalDay(addDays(today, 1), timeZone),
    yesterdayStart: startOfLocalDay(addDays(today, -1), timeZone),
    weekStart: startOfLocalDay(weekStart, timeZone),
    previousWeekStart: startOfLocalDay(addDays(weekStart, -7), timeZone),
    monthStart: startOfLocalDay(monthStart, timeZone),
  };
}
