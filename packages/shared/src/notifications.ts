import { z } from 'zod';
import { paginationQuerySchema } from './common';

export const NOTIFICATION_TYPES = [
  'GOAL_PROGRESS',
  'GOAL_COMPLETED',
  'DEVICE_CONNECTED',
  'DEVICE_REVOKED',
  'SECURITY',
  'SESSION_RECORDED',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unread: z.enum(['true', 'false']).optional(),
});
export type ListNotificationsQuery = Partial<z.output<typeof listNotificationsQuerySchema>>;

export const markNotificationSchema = z.object({ read: z.boolean() });

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  /** In-app path to open, e.g. /devices. */
  link: string | null;
  read: boolean;
  createdAt: string;
}
