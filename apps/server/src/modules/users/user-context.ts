import { prisma } from '../../database/prisma';
import { notFound } from '../../utils/errors';

export interface UserCalendar {
  timezone: string;
  weekStartsOn: number;
}

/** Time zone and week start used for calendar-based totals. */
export async function getUserCalendar(userId: string): Promise<UserCalendar> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true, settings: { select: { weekStartsOn: true } } },
  });
  if (!user) throw notFound('User');
  return { timezone: user.timezone, weekStartsOn: user.settings?.weekStartsOn ?? 1 };
}
