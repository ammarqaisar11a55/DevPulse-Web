import { z } from 'zod';
import { idSchema } from './common';

export const GOAL_METRICS = ['CODING_TIME', 'SESSIONS'] as const;
export const GOAL_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

export const MAX_ACTIVE_GOALS = 20;

/** Upper bound for a target per period (seconds for time goals, count for session goals). */
const MAX_TARGET: Record<GoalPeriod, { seconds: number; sessions: number }> = {
  DAILY: { seconds: 24 * 3600, sessions: 50 },
  WEEKLY: { seconds: 7 * 24 * 3600, sessions: 350 },
  MONTHLY: { seconds: 31 * 24 * 3600, sessions: 1500 },
};

export const createGoalSchema = z
  .object({
    metric: z.enum(GOAL_METRICS),
    period: z.enum(GOAL_PERIODS),
    /** Seconds for CODING_TIME, a session count for SESSIONS. */
    target: z.number().int().positive('Enter a target above zero'),
    projectId: idSchema.nullable().optional(),
    title: z.string().trim().max(80).optional(),
  })
  .refine(
    (goal) =>
      goal.target <=
      MAX_TARGET[goal.period][goal.metric === 'CODING_TIME' ? 'seconds' : 'sessions'],
    { message: 'This target is longer than the period itself', path: ['target'] },
  )
  .refine((goal) => goal.metric === 'SESSIONS' || goal.target >= 60, {
    message: 'Time goals must be at least one minute',
    path: ['target'],
  });
export type CreateGoalInput = z.input<typeof createGoalSchema>;

export const updateGoalSchema = z.object({
  target: z.number().int().positive().optional(),
  title: z.string().trim().max(80).nullable().optional(),
  archived: z.boolean().optional(),
});
export type UpdateGoalInput = z.input<typeof updateGoalSchema>;

export interface GoalProgress {
  current: number;
  target: number;
  /** current / target, not capped. */
  ratio: number;
  completed: boolean;
  periodStart: string;
  periodEnd: string;
}

export interface GoalDto {
  id: string;
  metric: GoalMetric;
  period: GoalPeriod;
  target: number;
  title: string | null;
  project: { id: string; name: string; color: string | null } | null;
  archivedAt: string | null;
  createdAt: string;
  progress: GoalProgress;
}
