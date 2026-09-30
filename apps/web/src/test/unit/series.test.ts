import { describe, expect, it } from 'vitest';
import { OTHER_SERIES_COLOR, projectColor, seriesColor } from '@/lib/colors';
import { foldSeries } from '@/lib/series';

describe('chart series', () => {
  it('assigns palette slots in order and never recycles hues', () => {
    expect(seriesColor(0)).toBe('var(--chart-1)');
    expect(seriesColor(5)).toBe('var(--chart-6)');
    expect(seriesColor(6)).toBe(OTHER_SERIES_COLOR);
  });

  it('folds series beyond the palette into Other', () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      name: `lang${index}`,
      seconds: 100 - index,
    }));
    const folded = foldSeries(items, (item) => ({
      key: item.name,
      label: item.name,
      seconds: item.seconds,
    }));
    expect(folded).toHaveLength(6);
    expect(folded.at(-1)).toEqual({
      key: '__other',
      label: 'Other',
      seconds: 95 + 94 + 93,
      color: OTHER_SERIES_COLOR,
    });
    expect(new Set(folded.map((item) => item.color)).size).toBe(6);
  });

  it('maps project colour keys and falls back to neutral', () => {
    expect(projectColor('teal')).toBe('var(--chart-2)');
    expect(projectColor(null)).toBe(OTHER_SERIES_COLOR);
    expect(projectColor('unknown')).toBe(OTHER_SERIES_COLOR);
  });
});
