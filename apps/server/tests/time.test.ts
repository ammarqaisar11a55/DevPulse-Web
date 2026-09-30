import { describe, expect, it } from 'vitest';
import {
  addDays,
  calendarBoundaries,
  diffInDays,
  startOfLocalDay,
  startOfLocalWeek,
  timeZoneOffsetMs,
  toLocalDate,
} from '../src/utils/time';

const HOUR = 3_600_000;

describe('time zone utilities', () => {
  it('computes fixed and DST-aware offsets', () => {
    expect(timeZoneOffsetMs(new Date('2026-01-15T12:00:00Z'), 'Asia/Karachi')).toBe(5 * HOUR);
    expect(timeZoneOffsetMs(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-5 * HOUR);
    expect(timeZoneOffsetMs(new Date('2026-07-15T12:00:00Z'), 'America/New_York')).toBe(-4 * HOUR);
    expect(timeZoneOffsetMs(new Date('2026-07-15T12:00:00Z'), 'UTC')).toBe(0);
  });

  it('finds the local calendar date of an instant', () => {
    // 20:30 UTC is already the next day in Karachi (UTC+5).
    expect(toLocalDate(new Date('2026-03-10T20:30:00Z'), 'Asia/Karachi')).toEqual({
      year: 2026,
      month: 3,
      day: 11,
    });
    expect(toLocalDate(new Date('2026-03-10T02:30:00Z'), 'America/Los_Angeles')).toEqual({
      year: 2026,
      month: 3,
      day: 9,
    });
  });

  it('finds local midnight, including on DST transition days', () => {
    expect(startOfLocalDay({ year: 2026, month: 3, day: 11 }, 'Asia/Karachi').toISOString()).toBe(
      '2026-03-10T19:00:00.000Z',
    );
    // US DST starts 2026-03-08 at 02:00; midnight is still EST (UTC-5).
    expect(
      startOfLocalDay({ year: 2026, month: 3, day: 8 }, 'America/New_York').toISOString(),
    ).toBe('2026-03-08T05:00:00.000Z');
    // The following midnight is EDT (UTC-4): that day is 23 hours long.
    expect(
      startOfLocalDay({ year: 2026, month: 3, day: 9 }, 'America/New_York').toISOString(),
    ).toBe('2026-03-09T04:00:00.000Z');
  });

  it('does calendar arithmetic across month and year boundaries', () => {
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(addDays({ year: 2028, month: 3, day: 1 }, -1)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
    expect(diffInDays({ year: 2026, month: 1, day: 1 }, { year: 2026, month: 3, day: 1 })).toBe(59);
  });

  it('starts weeks on the configured day', () => {
    // 2026-09-30 is a Wednesday.
    expect(startOfLocalWeek({ year: 2026, month: 9, day: 30 }, 1)).toEqual({
      year: 2026,
      month: 9,
      day: 28,
    });
    expect(startOfLocalWeek({ year: 2026, month: 9, day: 30 }, 0)).toEqual({
      year: 2026,
      month: 9,
      day: 27,
    });
    expect(startOfLocalWeek({ year: 2026, month: 9, day: 27 }, 1)).toEqual({
      year: 2026,
      month: 9,
      day: 21,
    });
  });

  it('derives calendar boundaries for a user', () => {
    const b = calendarBoundaries(new Date('2026-09-30T10:00:00Z'), 'Asia/Karachi', 1);
    expect(b.todayStart.toISOString()).toBe('2026-09-29T19:00:00.000Z');
    expect(b.weekStart.toISOString()).toBe('2026-09-27T19:00:00.000Z');
    expect(b.previousWeekStart.toISOString()).toBe('2026-09-20T19:00:00.000Z');
    expect(b.monthStart.toISOString()).toBe('2026-08-31T19:00:00.000Z');
  });
});
