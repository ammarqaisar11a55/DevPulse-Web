import {
  MAX_ACTIVE_GOALS,
  type createGoalSchema,
  type GoalDto,
  type GoalPeriod,
  type updateGoalSchema,
} from '@devpulse/shared';
import type { Goal } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../database/prisma';
import { activeSecondsInRange } from '../../database/session-time';
import { badRequest, notFound } from '../../utils/errors';
import {
  addDays,
  startOfLocalDay,
  startOfLocalWeek,
  toLocalDate,
  type LocalDate,
} from '../../utils/time';
import { getUserCalendar, type UserCalendar } from '../users/user-context';

type GoalWithProject = Goal & {
  project: { id: string; name: string; color: string | null } | null;
};

const projectSelect = { project: { select: { id: true, name: true, color: true } } } as const;

/** Local calendar window [start, end) of the goal's current period. */
export function goalWindow(period: GoalPeriod, calendar: UserCalendar, now = new Date()) {
  const today = toLocalDate(now, calendar.timezone);
  let first: LocalDate;
  let next: LocalDate;
  if (period === 'DAILY') {
    first = today;
    next = addDays(today, 1);
  } else if (period === 'WEEKLY') {
    first = startOfLocalWeek(today, calendar.weekStartsOn);
    next = addDays(first, 7);
  } else {
    first = { year: today.year, month: today.month, day: 1 };
    next =
      today.month === 12
        ? { year: today.year + 1, month: 1, day: 1 }
        : { year: today.year, month: today.month + 1, day: 1 };
  }
  return {
    start: startOfLocalDay(first, calendar.timezone),
    end: startOfLocalDay(next, calendar.timezone),
  };
}

/** Progress towards a goal in its current period. */
export async function measureGoal(goal: Goal, calendar: UserCalendar, now = new Date()) {
  const { start, end } = goalWindow(goal.period, calendar, now);
  const until = now < end ? now : end;
  const current =
    goal.metric === 'CODING_TIME'
      ? await activeSecondsInRange(
          { userId: goal.userId, projectId: goal.projectId ?? undefined },
          start,
          until,
        )
      : await prisma.codingSession.count({
          where: {
            userId: goal.userId,
            ...(goal.projectId ? { projectId: goal.projectId } : {}),
            startedAt: { gte: start, lt: until },
          },
        });
  const ratio = goal.target > 0 ? current / goal.target : 0;
  return {
    current,
    target: goal.target,
    ratio,
    completed: ratio >= 1,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

async function toDto(goal: GoalWithProject, calendar: UserCalendar): Promise<GoalDto> {
  return {
    id: goal.id,
    metric: goal.metric,
    period: goal.period,
    target: goal.target,
    title: goal.title,
    project: goal.project,
    archivedAt: goal.archivedAt?.toISOString() ?? null,
    createdAt: goal.createdAt.toISOString(),
    progress: await measureGoal(goal, calendar),
  };
}

async function requireOwned(userId: string, id: string) {
  const goal = await prisma.goal.findFirst({ where: { id, userId }, include: projectSelect });
  if (!goal) throw notFound('Goal');
  return goal;
}

export const goalsService = {
  async list(userId: string, includeArchived = false) {
    const [goals, calendar] = await Promise.all([
      prisma.goal.findMany({
        where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
        include: projectSelect,
        orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      }),
      getUserCalendar(userId),
    ]);
    return Promise.all(goals.map((goal) => toDto(goal, calendar)));
  },

  async create(userId: string, input: z.output<typeof createGoalSchema>) {
    const active = await prisma.goal.count({ where: { userId, archivedAt: null } });
    if (active >= MAX_ACTIVE_GOALS)
      throw badRequest(`You can have up to ${MAX_ACTIVE_GOALS} active goals`);
    if (input.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, userId },
        select: { id: true },
      });
      if (!project) throw notFound('Project');
    }
    const goal = await prisma.goal.create({
      data: {
        userId,
        metric: input.metric,
        period: input.period,
        target: input.target,
        projectId: input.projectId ?? null,
        title: input.title || null,
      },
      include: projectSelect,
    });
    return toDto(goal, await getUserCalendar(userId));
  },

  async update(userId: string, id: string, input: z.output<typeof updateGoalSchema>) {
    await requireOwned(userId, id);
    const goal = await prisma.goal.update({
      where: { id },
      data: {
        ...(input.target !== undefined ? { target: input.target } : {}),
        ...(input.title !== undefined ? { title: input.title || null } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
      },
      include: projectSelect,
    });
    return toDto(goal, await getUserCalendar(userId));
  },

  async remove(userId: string, id: string) {
    await requireOwned(userId, id);
    await prisma.goal.delete({ where: { id } });
  },
};
