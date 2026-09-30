import type { DeviceDto } from '@devpulse/shared';
import type { Device } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { emitDomainEvent } from '../../utils/domain-events';
import { notFound } from '../../utils/errors';
import { sessionsRepository } from '../sessions/sessions.repository';

type Totals = Map<string, { seconds: number; sessions: number }>;

function toDto(device: Device, totals: Totals): DeviceDto {
  const usage = totals.get(device.id);
  return {
    id: device.id,
    name: device.name,
    platform: device.platform,
    editor: device.editor,
    editorVersion: device.editorVersion,
    extensionVersion: device.extensionVersion,
    credentialPrefix: device.credentialPrefix,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    createdAt: device.createdAt.toISOString(),
    revokedAt: device.revokedAt?.toISOString() ?? null,
    totalSeconds: usage?.seconds ?? 0,
    sessionCount: usage?.sessions ?? 0,
  };
}

async function usageFor(userId: string, deviceIds: string[]): Promise<Totals> {
  if (deviceIds.length === 0) return new Map();
  const rows = await prisma.codingSession.groupBy({
    by: ['deviceId'],
    where: { userId, deviceId: { in: deviceIds } },
    _sum: { activeSeconds: true },
    _count: { _all: true },
  });
  return new Map(
    rows.flatMap((row) =>
      row.deviceId
        ? [[row.deviceId, { seconds: row._sum.activeSeconds ?? 0, sessions: row._count._all }]]
        : [],
    ),
  );
}

async function requireOwned(userId: string, id: string) {
  const device = await prisma.device.findFirst({ where: { id, userId } });
  if (!device) throw notFound('Device');
  return device;
}

export const devicesService = {
  /** Connected devices first (most recently seen), then revoked ones. */
  async list(userId: string) {
    const devices = await prisma.device.findMany({
      where: { userId },
      orderBy: [
        { revokedAt: { sort: 'desc', nulls: 'first' } },
        { lastSeenAt: { sort: 'desc', nulls: 'last' } },
      ],
    });
    const totals = await usageFor(
      userId,
      devices.map((device) => device.id),
    );
    return devices.map((device) => toDto(device, totals));
  },

  async get(userId: string, id: string) {
    const device = await requireOwned(userId, id);
    return toDto(device, await usageFor(userId, [id]));
  },

  async rename(userId: string, id: string, name: string) {
    await requireOwned(userId, id);
    const device = await prisma.device.update({ where: { id }, data: { name } });
    return toDto(device, await usageFor(userId, [id]));
  },

  /**
   * Revokes the device's credential immediately. The record is kept (soft revocation) so past
   * sessions keep their attribution and the change stays auditable.
   */
  async revoke(userId: string, id: string) {
    const device = await requireOwned(userId, id);
    if (device.revokedAt) return;
    await prisma.device.update({ where: { id }, data: { revokedAt: new Date() } });
    // Sessions left open by the device can no longer be completed by it: end them at their last heartbeat.
    await sessionsRepository.closeStale({ deviceId: id });
    await emitDomainEvent('device.revoked', { userId, deviceId: id, name: device.name });
  },
};
