import { DEVICE_CREDENTIAL_PREFIX } from '@devpulse/shared';
import type { RequestHandler } from 'express';
import { prisma } from '../../database/prisma';
import { bearerToken } from '../../middleware/authenticate';
import { unauthorized } from '../../utils/errors';
import { hashDeviceCredential } from './pairing.service';

/** lastSeenAt is refreshed at most this often to avoid a write on every request. */
const LAST_SEEN_THROTTLE_MS = 60_000;

/**
 * Authenticates requests from a paired editor using its device credential. Revoked devices
 * are rejected immediately.
 */
export const requireDevice: RequestHandler = async (req, _res, next) => {
  const token = bearerToken(req.get('authorization'));
  if (!token?.startsWith(DEVICE_CREDENTIAL_PREFIX))
    return next(unauthorized('A device credential is required'));

  const device = await prisma.device.findUnique({
    where: { credentialHash: hashDeviceCredential(token) },
    select: { id: true, userId: true, revokedAt: true, lastSeenAt: true },
  });
  if (!device || device.revokedAt) {
    return next(unauthorized('This device is not connected. Pair it again from DevPulse.'));
  }

  if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  }
  req.device = { deviceId: device.id, userId: device.userId };
  next();
};

export function currentDevice(req: Express.Request) {
  if (!req.device) throw unauthorized();
  return req.device;
}
