import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GoalMetric, GoalPeriod } from '@devpulse/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { activityApi, activityKeys } from '@/features/activity/activity-api';
import { getErrorMessage } from '@/lib/api-client';
import { goalKeys, goalsApi } from '../goals-api';

const DEFAULT_HOURS: Record<GoalPeriod, string> = { DAILY: '4', WEEKLY: '25', MONTHLY: '100' };
const DEFAULT_SESSIONS: Record<GoalPeriod, string> = { DAILY: '3', WEEKLY: '15', MONTHLY: '60' };

export function CreateGoalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [metric, setMetric] = useState<GoalMetric>('CODING_TIME');
  const [period, setPeriod] = useState<GoalPeriod>('WEEKLY');
  const [amount, setAmount] = useState(DEFAULT_HOURS.WEEKLY);
  const [projectId, setProjectId] = useState('');
  const options = useQuery({
    queryKey: activityKeys.filters,
    queryFn: ({ signal }) => activityApi.filters(signal),
    enabled: open,
  });

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;

  const create = useMutation({
    mutationFn: () =>
      goalsApi.create({
        metric,
        period,
        target: metric === 'CODING_TIME' ? Math.round(value * 3600) : Math.round(value),
        projectId: projectId || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
      toast.success('Goal created');
      onOpenChange(false);
    },
  });

  const resetAmount = (nextMetric: GoalMetric, nextPeriod: GoalPeriod) =>
    setAmount(
      nextMetric === 'CODING_TIME' ? DEFAULT_HOURS[nextPeriod] : DEFAULT_SESSIONS[nextPeriod],
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="New goal"
        description="Goals reset at the start of each day, week or month in your time zone."
      >
        <form
          id="create-goal"
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) create.mutate();
          }}
        >
          {create.isError && <Alert>{getErrorMessage(create.error)}</Alert>}
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Measure</span>
            <SegmentedControl<GoalMetric>
              label="Goal measure"
              value={metric}
              onChange={(next) => {
                setMetric(next);
                resetAmount(next, period);
              }}
              options={[
                { value: 'CODING_TIME', label: 'Coding time' },
                { value: 'SESSIONS', label: 'Sessions' },
              ]}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Every</span>
            <SegmentedControl<GoalPeriod>
              label="Goal period"
              value={period}
              onChange={(next) => {
                setPeriod(next);
                resetAmount(metric, next);
              }}
              options={[
                { value: 'DAILY', label: 'Day' },
                { value: 'WEEKLY', label: 'Week' },
                { value: 'MONTHLY', label: 'Month' },
              ]}
            />
          </div>
          <Field
            label={metric === 'CODING_TIME' ? 'Target hours' : 'Target sessions'}
            error={amount && !valid ? 'Enter a number above zero' : undefined}
          >
            <Input
              type="number"
              inputMode="decimal"
              min={metric === 'CODING_TIME' ? 0.5 : 1}
              step={metric === 'CODING_TIME' ? 0.5 : 1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="sm:w-40"
            />
          </Field>
          <Field label="Project" optional hint="Leave empty to count all your coding.">
            <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">All projects</option>
              {options.data?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
        </form>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form="create-goal" loading={create.isPending} disabled={!valid}>
            Create goal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
