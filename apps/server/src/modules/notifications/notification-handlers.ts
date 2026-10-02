import { prisma } from '../../database/prisma';
import { onDomainEvent } from '../../utils/domain-events';
import { formatLocalDate, toLocalDate } from '../../utils/time';
import { measureGoal } from '../goals/goals.service';
import { getUserCalendar } from '../users/user-context';
import { notificationsService } from './notifications.service';

/** Share of a goal at which a single "almost there" notice is sent per period. */
const GOAL_PROGRESS_THRESHOLD = 0.8;

let registered = false;

function formatHours(seconds: number) {
  const hours = seconds / 3600;
  return hours >= 1
    ? `${Math.round(hours * 10) / 10} hours`
    : `${Math.round(seconds / 60)} minutes`;
}

/** Subscribes notification producers to domain events. Safe to call more than once. */
export function registerNotificationHandlers() {
  if (registered) return;
  registered = true;

  onDomainEvent('device.connected', async ({ userId, name }) => {
    await notificationsService.create(userId, {
      type: 'DEVICE_CONNECTED',
      title: 'New device connected',
      body: `${name} was paired with your account. If this was not you, revoke it now.`,
      link: '/devices',
    });
  });

  onDomainEvent('device.revoked', async ({ userId, name }) => {
    await notificationsService.create(userId, {
      type: 'DEVICE_REVOKED',
      title: 'Device access revoked',
      body: `${name} can no longer sync activity.`,
      link: '/devices',
    });
  });

  onDomainEvent('security.password_changed', async ({ userId }) => {
    await notificationsService.create(userId, {
      type: 'SECURITY',
      title: 'Your password was changed',
      body: 'Other sessions were signed out. If you did not do this, reset your password immediately.',
      link: '/settings/security',
    });
  });

  onDomainEvent('security.email_changed', async ({ userId, newEmail }) => {
    await notificationsService.create(userId, {
      type: 'SECURITY',
      title: 'Your email address was changed',
      body: `You now sign in with ${newEmail}. If you did not do this, reset your password immediately.`,
      link: '/settings/profile',
    });
  });

  // When a session is recorded, check the user's goals and notify once per goal per period.
  onDomainEvent('session.recorded', async ({ userId, projectId }) => {
    const goals = await prisma.goal.findMany({
      where: {
        userId,
        archivedAt: null,
        OR: [{ projectId: null }, ...(projectId ? [{ projectId }] : [])],
      },
      include: { project: { select: { name: true } } },
    });
    if (goals.length === 0) return;
    const calendar = await getUserCalendar(userId);

    for (const goal of goals) {
      const progress = await measureGoal(goal, calendar);
      const period = formatLocalDate(
        toLocalDate(new Date(progress.periodStart), calendar.timezone),
      );
      const unit =
        goal.period === 'DAILY' ? 'today' : goal.period === 'WEEKLY' ? 'this week' : 'this month';
      const name = goal.title ?? (goal.project ? `${goal.project.name} goal` : 'goal');
      const target =
        goal.metric === 'CODING_TIME' ? formatHours(goal.target) : `${goal.target} sessions`;

      if (progress.completed) {
        await notificationsService.create(userId, {
          type: 'GOAL_COMPLETED',
          title: `${name} reached`,
          body: `You hit ${target} ${unit}.`,
          link: '/goals',
          dedupeKey: `goal-completed:${goal.id}:${period}`,
        });
      } else if (progress.ratio >= GOAL_PROGRESS_THRESHOLD) {
        const remaining =
          goal.metric === 'CODING_TIME'
            ? formatHours(goal.target - progress.current)
            : `${goal.target - progress.current} sessions`;
        await notificationsService.create(userId, {
          type: 'GOAL_PROGRESS',
          title: `${name} is ${Math.floor(progress.ratio * 100)}% complete`,
          body: `About ${remaining} to go ${unit}.`,
          link: '/goals',
          dedupeKey: `goal-progress:${goal.id}:${period}`,
        });
      }
    }
  });
}
