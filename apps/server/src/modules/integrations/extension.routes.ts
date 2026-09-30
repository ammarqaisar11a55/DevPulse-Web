import { Router } from 'express';
import {
  createSessionSchema,
  idParamsSchema,
  ingestEventsSchema,
  updateSessionSchema,
} from '@devpulse/shared';
import type { z } from 'zod';
import { prisma } from '../../database/prisma';
import { createRateLimiter } from '../../middleware/rate-limit';
import { valid, validate } from '../../middleware/validate';
import { emitDomainEvent } from '../../utils/domain-events';
import { activityService } from '../activity/activity.service';
import { sessionsService } from '../sessions/sessions.service';
import { currentDevice, requireDevice } from './device-auth';
import { extensionConfig } from './pairing.service';
import { applyTrackingPreferences } from './tracking-privacy';

/*
 * Endpoints called by the DevPulse editor extension, authenticated with a device credential.
 * Kept in the integrations module so editor-specific concerns stay out of the web API.
 */

const ingestLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: (req) => req.device?.deviceId ?? req.ip ?? 'unknown',
});

/** Mounted at /activity: session and event ingestion. */
export const extensionActivityRouter = Router();
extensionActivityRouter.use('/sessions', requireDevice, ingestLimiter);
extensionActivityRouter.use('/events', requireDevice, ingestLimiter);

extensionActivityRouter.post(
  '/sessions',
  validate('body', createSessionSchema),
  async (req, res) => {
    const actor = currentDevice(req);
    const input = await applyTrackingPreferences(
      actor.userId,
      valid<z.output<typeof createSessionSchema>>(req, 'body'),
    );
    const { session, created } = await sessionsService.create(actor, input);
    res.status(created ? 201 : 200).json({ data: session });
  },
);

extensionActivityRouter.patch(
  '/sessions/:id',
  validate('params', idParamsSchema),
  validate('body', updateSessionSchema),
  async (req, res) => {
    const actor = currentDevice(req);
    const input = await applyTrackingPreferences(
      actor.userId,
      valid<z.output<typeof updateSessionSchema>>(req, 'body'),
    );
    const { id } = valid<{ id: string }>(req, 'params');
    res.json({ data: await sessionsService.update(actor, id, input) });
  },
);

extensionActivityRouter.post('/events', validate('body', ingestEventsSchema), async (req, res) => {
  res
    .status(202)
    .json({ data: await activityService.ingestEvents(currentDevice(req), valid(req, 'body')) });
});

/** Mounted at /integrations/extension: device-level endpoints. */
export const extensionRouter = Router();
extensionRouter.use(requireDevice);

/** Tracking preferences the extension must apply; poll on startup and periodically. */
extensionRouter.get('/config', async (req, res) => {
  const { userId, deviceId } = currentDevice(req);
  const [config, device, user] = await Promise.all([
    extensionConfig(userId),
    prisma.device.findUniqueOrThrow({ where: { id: deviceId }, select: { id: true, name: true } }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true, fullName: true },
    }),
  ]);
  res.json({ data: { config, device, account: user } });
});

/** Lets the extension disconnect itself (e.g. the user signs out in the editor). */
extensionRouter.post('/disconnect', async (req, res) => {
  const { userId, deviceId } = currentDevice(req);
  const device = await prisma.device.update({
    where: { id: deviceId },
    data: { revokedAt: new Date() },
    select: { name: true },
  });
  await emitDomainEvent('device.revoked', { userId, deviceId, name: device.name });
  res.status(204).end();
});
