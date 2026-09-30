import { Router } from 'express';
import { idParamsSchema, pairDeviceSchema } from '@devpulse/shared';
import { currentUserId, requireUser } from '../../middleware/authenticate';
import { createRateLimiter } from '../../middleware/rate-limit';
import { valid, validate } from '../../middleware/validate';
import { extensionRouter } from './extension.routes';
import { pairingService } from './pairing.service';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Per user: generating keys is cheap for us but each one is a live credential for 10 minutes. */
const keyGenerationLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  keyGenerator: (req) => req.auth?.userId ?? req.ip ?? 'unknown',
  message: 'Too many connection keys requested. Please wait a few minutes.',
});

/** Per client IP: limits online guessing of pairing keys. */
const pairLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  message: 'Too many pairing attempts. Please wait a few minutes and try again.',
});

export const integrationsRouter = Router();

integrationsRouter.post('/pairing-keys', requireUser, keyGenerationLimiter, async (req, res) => {
  res.status(201).json({ data: await pairingService.createKey(currentUserId(req)) });
});

integrationsRouter.get('/pairing-keys', requireUser, async (req, res) => {
  res.json({ data: await pairingService.listKeys(currentUserId(req)) });
});

integrationsRouter.delete(
  '/pairing-keys/:id',
  requireUser,
  validate('params', idParamsSchema),
  async (req, res) => {
    await pairingService.revokeKey(currentUserId(req), valid<{ id: string }>(req, 'params').id);
    res.status(204).end();
  },
);

/** Public: called by the extension with the key the user typed in. */
integrationsRouter.post(
  '/pair',
  pairLimiter,
  validate('body', pairDeviceSchema),
  async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ data: await pairingService.pair(valid(req, 'body')) });
  },
);

integrationsRouter.use('/extension', extensionRouter);
