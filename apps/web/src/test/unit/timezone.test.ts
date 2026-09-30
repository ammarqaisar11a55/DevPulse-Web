import { describe, expect, it } from 'vitest';
import { dayLabel, localDateKey, minutesOfDay, resolveRange } from '@/lib/timezone';

const NOW = new Date('2026-09-30T10:00:00Z'); // 15:00 in Karachi

describe('time zone helpers', () => {
  it('keys instants by local calendar date', () => {
    expect(localDateKey('2026-09-30T20:30:00Z', 'Asia/Karachi')).toBe('2026-10-01');
    expect(localDateKey('2026-09-30T20:30:00Z', 'UTC')).toBe('2026-09-30');
    expect(minutesOfDay('2026-09-30T10:15:00Z', 'Asia/Karachi')).toBe(15 * 60 + 15);
  });

  it('labels today and yesterday', () => {
    expect(dayLabel('2026-09-30', 'Asia/Karachi', NOW)).toBe('Today');
    expect(dayLabel('2026-09-29', 'Asia/Karachi', NOW)).toBe('Yesterday');
    expect(dayLabel('2026-09-20', 'Asia/Karachi', NOW)).not.toMatch(/Today|Yesterday/);
  });

  it('resolves presets to local day boundaries', () => {
    const today = resolveRange('today', 'Asia/Karachi', undefined, NOW);
    expect(today.from?.toISOString()).toBe('2026-09-29T19:00:00.000Z');
    expect(today.to?.toISOString()).toBe('2026-09-30T19:00:00.000Z');

    const week = resolveRange('7d', 'UTC', undefined, NOW);
    expect(week.from?.toISOString()).toBe('2026-09-24T00:00:00.000Z');

    const custom = resolveRange('custom', 'UTC', { from: '2026-09-01', to: '2026-09-03' }, NOW);
    expect(custom).toEqual({
      from: new Date('2026-09-01T00:00:00Z'),
      to: new Date('2026-09-04T00:00:00Z'),
    });

    expect(resolveRange('all', 'UTC', undefined, NOW)).toEqual({});
  });
});
