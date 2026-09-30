import { Router } from 'express';
import { idParamsSchema, updateDeviceSchema } from '@devpulse/shared';
import { currentUserId, requireUser } from '../../middleware/authenticate';
import { valid, validate } from '../../middleware/validate';
import { devicesService } from './devices.service';

const idOf = (req: Express.Request) => valid<{ id: string }>(req, 'params').id;

export const devicesRouter = Router();

devicesRouter.use(requireUser);
devicesRouter.get('/', async (req, res) => {
  res.json({ data: await devicesService.list(currentUserId(req)) });
});
devicesRouter.get('/:id', validate('params', idParamsSchema), async (req, res) => {
  res.json({ data: await devicesService.get(currentUserId(req), idOf(req)) });
});
devicesRouter.patch(
  '/:id',
  validate('params', idParamsSchema),
  validate('body', updateDeviceSchema),
  async (req, res) => {
    res.json({
      data: await devicesService.rename(
        currentUserId(req),
        idOf(req),
        valid<{ name: string }>(req, 'body').name,
      ),
    });
  },
);
/** Revokes the device (its credential stops working immediately). */
devicesRouter.delete('/:id', validate('params', idParamsSchema), async (req, res) => {
  await devicesService.revoke(currentUserId(req), idOf(req));
  res.status(204).end();
});
