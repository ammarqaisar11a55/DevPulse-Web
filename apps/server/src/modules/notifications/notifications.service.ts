import type { NotificationDto, NotificationType } from '@devpulse/shared';
import type { Notification, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { notFound } from '../../utils/errors';
import { pageMeta, skipTake } from '../../utils/pagination';

/** Notifications older than this are pruned when new ones are created. */
const RETENTION_DAYS = 90;

export interface NewNotification {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  /** Prevents the same event from notifying twice (e.g. one goal completion per period). */
  dedupeKey?: string;
}

function toDto(notification: Notification): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    read: notification.readAt !== null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export const notificationsService = {
  /** Creates a notification; returns false if one with the same dedupe key already exists. */
  async create(userId: string, input: NewNotification) {
    const result = await prisma.notification.createMany({
      data: [
        {
          userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          link: input.link ?? null,
          dedupeKey: input.dedupeKey ?? null,
        },
      ],
      skipDuplicates: true,
    });
    await prisma.notification.deleteMany({
      where: { userId, createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } },
    });
    return result.count === 1;
  },

  async list(userId: string, query: { page: number; pageSize: number; unread?: 'true' | 'false' }) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unread === 'true' ? { readAt: null } : {}),
    };
    const { skip, take } = skipTake(query.page, query.pageSize);
    const [total, rows, unread] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      data: rows.map(toDto),
      meta: { ...pageMeta(query.page, query.pageSize, total), unread },
    };
  },

  unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, readAt: null } });
  },

  async mark(userId: string, id: string, read: boolean) {
    const result = await prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: read ? new Date() : null },
    });
    if (result.count === 0) throw notFound('Notification');
  },

  async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  },

  async remove(userId: string, id: string) {
    const result = await prisma.notification.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw notFound('Notification');
  },
};
