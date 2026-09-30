import type { GoalDto, GoalPeriod } from '@devpulse/shared';
import { formatDuration } from '@/lib/format';

const PERIOD_NAMES: Record<GoalPeriod, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};
const PERIOD_UNITS: Record<GoalPeriod, string> = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' };

export function goalValue(goal: Pick<GoalDto, 'metric'>, value: number) {
  if (goal.metric === 'CODING_TIME') return formatDuration(value, { compact: true });
  return `${value} ${value === 1 ? 'session' : 'sessions'}`;
}

/** Default title, e.g. "Weekly coding time" or "20 sessions per month". */
export function goalTitle(goal: GoalDto) {
  if (goal.title) return goal.title;
  const scope = goal.project ? ` on ${goal.project.name}` : '';
  if (goal.metric === 'CODING_TIME') return `${PERIOD_NAMES[goal.period]} coding time${scope}`;
  return `${goal.target} sessions per ${PERIOD_UNITS[goal.period]}${scope}`;
}

export function periodLabel(period: GoalPeriod) {
  return `this ${PERIOD_UNITS[period]}`;
}
