import { MAX_SERIES, OTHER_SERIES_COLOR, seriesColor } from './colors';

export interface SeriesItem {
  key: string;
  label: string;
  seconds: number;
  color: string;
}

/**
 * Keeps the largest `MAX_SERIES - 1` items and folds the rest into a single "Other" entry,
 * so no two series ever share a hue. Items must be sorted by descending value.
 */
export function foldSeries<T>(
  items: T[],
  toItem: (item: T, index: number) => Omit<SeriesItem, 'color'> & { color?: string },
): SeriesItem[] {
  const mapped = items.map((item, index) => {
    const base = toItem(item, index);
    return { ...base, color: base.color ?? seriesColor(index) };
  });
  if (mapped.length <= MAX_SERIES) return mapped;
  const kept = mapped.slice(0, MAX_SERIES - 1);
  const otherSeconds = mapped.slice(MAX_SERIES - 1).reduce((sum, item) => sum + item.seconds, 0);
  return [
    ...kept,
    { key: '__other', label: 'Other', seconds: otherSeconds, color: OTHER_SERIES_COLOR },
  ];
}
