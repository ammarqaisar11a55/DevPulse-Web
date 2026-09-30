import { Router } from 'express';
import {
  idParamsSchema,
  listNotificationsQuerySchema,
  markNotificationSchema,
} from '@devpulse/shared';
import { currentUserId, requireUser } from '../../middleware/authenticate';
import { valid, validate } from '../../middleware/validate';
import { notificationsService } from './notifications.service';

const idOf = (req: Express.Request) => valid<{ id: string }>(req, 'params').id;

export const notificationsRouter = Router();

notificationsRouter.use(requireUser);
notificationsRouter.get('/', validate('query', listNotificationsQuerySchema), async (req, res) => {
  res.json(await notificationsService.list(currentUserId(req), valid(req, 'query')));
});
notificationsRouter.get('/unread-count', async (req, res) => {
  res.json({ data: { count: await notificationsService.unreadCount(currentUserId(req)) } });
});
notificationsRouter.post('/read-all', async (req, res) => {
  res.json({ data: { updated: await notificationsService.markAllRead(currentUserId(req)) } });
});
notificationsRouter.patch(
  '/:id',
  validate('params', idParamsSchema),
  validate('body', markNotificationSchema),
  async (req, res) => {
    await notificationsService.mark(
      currentUserId(req),
      idOf(req),
      valid<{ read: boolean }>(req, 'body').read,
    );
    res.status(204).end();
  },
);
notificationsRouter.delete('/:id', validate('params', idParamsSchema), async (req, res) => {
  await notificationsService.remove(currentUserId(req), idOf(req));
  res.status(204).end();
});
