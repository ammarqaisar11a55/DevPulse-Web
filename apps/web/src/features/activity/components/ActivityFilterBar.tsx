import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { languageName } from '@/lib/languages';
import { RANGE_LABELS, type RangePreset } from '@/lib/timezone';
import { activityApi, activityKeys } from '../activity-api';
import type { ActivityFilterState } from '../useActivityFilters';

interface ActivityFilterBarProps {
  state: ActivityFilterState;
  onChange: (patch: Partial<ActivityFilterState>) => void;
  onReset: () => void;
  activeCount: number;
  ranges?: RangePreset[];
}

export function ActivityFilterBar({
  state,
  onChange,
  onReset,
  activeCount,
  ranges,
}: ActivityFilterBarProps) {
  const options = useQuery({
    queryKey: activityKeys.filters,
    queryFn: ({ signal }) => activityApi.filters(signal),
    staleTime: 5 * 60_000,
  });
  const presets = (ranges ?? (Object.keys(RANGE_LABELS) as RangePreset[])).filter(
    (preset): preset is Exclude<RangePreset, 'custom'> => preset !== 'custom',
  );

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select
          aria-label="Date range"
          value={state.range}
          onChange={(event) => onChange({ range: event.target.value as RangePreset })}
          className="col-span-2 sm:w-44"
        >
          {presets.map((preset) => (
            <option key={preset} value={preset}>
              {RANGE_LABELS[preset]}
            </option>
          ))}
          <option value="custom">Custom range</option>
        </Select>
        <Select
          aria-label="Project"
          value={state.projectId ?? ''}
          onChange={(event) => onChange({ projectId: event.target.value || null })}
          className="sm:w-44"
        >
          <option value="">All projects</option>
          <option value="none">No project</option>
          {options.data?.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Language"
          value={state.language ?? ''}
          onChange={(event) => onChange({ language: event.target.value || null })}
          className="sm:w-40"
        >
          <option value="">All languages</option>
          {options.data?.languages.map((language) => (
            <option key={language} value={language}>
              {languageName(language)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Device"
          value={state.deviceId ?? ''}
          onChange={(event) => onChange({ deviceId: event.target.value || null })}
          className="sm:w-40"
        >
          <option value="">All devices</option>
          {options.data?.devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Repository"
          value={state.repository ?? ''}
          onChange={(event) => onChange({ repository: event.target.value || null })}
          className="col-span-2 sm:w-52"
        >
          <option value="">All repositories</option>
          {options.data?.repositories.map((repository) => (
            <option key={repository} value={repository}>
              {repository}
            </option>
          ))}
        </Select>
        {(activeCount > 0 || state.range === 'custom') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            leadingIcon={<X />}
            className="col-span-2 justify-self-start"
          >
            Clear filters
          </Button>
        )}
      </div>
      {state.range === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-ink-muted">From</span>
            <Input
              type="date"
              value={state.from ?? ''}
              max={state.to ?? undefined}
              onChange={(event) => onChange({ from: event.target.value || null })}
              className="w-40"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-ink-muted">To</span>
            <Input
              type="date"
              value={state.to ?? ''}
              min={state.from ?? undefined}
              onChange={(event) => onChange({ to: event.target.value || null })}
              className="w-40"
            />
          </label>
        </div>
      )}
    </div>
  );
}
