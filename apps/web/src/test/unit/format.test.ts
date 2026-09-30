import { describe, expect, it } from 'vitest';
import { formatDuration, formatHours, percentChange } from '@/lib/format';

describe('formatDuration', () => {
  it.each([
    [0, '0m'],
    [20, '<1m'],
    [540, '9m'],
    [3600, '1h 00m'],
    [16_320, '4h 32m'],
    [99_660, '27h 41m'],
  ])('%i seconds → %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('omits zero minutes in compact mode', () => {
    expect(formatDuration(7200, { compact: true })).toBe('2h');
    expect(formatDuration(7260, { compact: true })).toBe('2h 01m');
  });
});

describe('formatHours', () => {
  it('rounds to one decimal below ten hours', () => {
    expect(formatHours(5400)).toBe('1.5h');
    expect(formatHours(40_000)).toBe('11h');
  });
});

describe('percentChange', () => {
  it('returns null without a baseline', () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(12, 10)).toBeCloseTo(0.2);
    expect(percentChange(5, 10)).toBe(-0.5);
  });
});
