import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useCurrentUser } from '@/features/auth/auth-context';
import { resolveRange, type RangePreset } from '@/lib/timezone';

export interface ActivityFilterState {
  range: RangePreset;
  from: string | null;
  to: string | null;
  projectId: string | null;
  language: string | null;
  deviceId: string | null;
  repository: string | null;
}

const KEYS = ['range', 'from', 'to', 'projectId', 'language', 'deviceId', 'repository'] as const;

/** Filter state stored in the URL so views are shareable and survive reloads. */
export function useActivityFilters(defaultRange: RangePreset = '30d') {
  const [params, setParams] = useSearchParams();
  const user = useCurrentUser();

  const state: ActivityFilterState = {
    range: (params.get('range') as RangePreset | null) ?? defaultRange,
    from: params.get('from'),
    to: params.get('to'),
    projectId: params.get('projectId'),
    language: params.get('language'),
    deviceId: params.get('deviceId'),
    repository: params.get('repository'),
  };

  const range = useMemo(
    () => resolveRange(state.range, user.timezone, { from: state.from, to: state.to }),
    [state.range, state.from, state.to, user.timezone],
  );

  /** API query parameters derived from the filter state. */
  const query = {
    from: range.from?.toISOString(),
    to: range.to?.toISOString(),
    projectId: state.projectId ?? undefined,
    language: state.language ?? undefined,
    deviceId: state.deviceId ?? undefined,
    repository: state.repository ?? undefined,
  };

  const update = (patch: Partial<ActivityFilterState>) => {
    const next = new URLSearchParams(params);
    for (const key of KEYS) {
      if (!(key in patch)) continue;
      const value = patch[key];
      if (value && !(key === 'range' && value === defaultRange)) next.set(key, value);
      else next.delete(key);
    }
    if (patch.range && patch.range !== 'custom') {
      next.delete('from');
      next.delete('to');
    }
    next.delete('page');
    setParams(next, { replace: true });
  };

  const activeCount = [state.projectId, state.language, state.deviceId, state.repository].filter(
    Boolean,
  ).length;
  const reset = () => setParams(new URLSearchParams(), { replace: true });

  return { state, query, update, reset, activeCount };
}
