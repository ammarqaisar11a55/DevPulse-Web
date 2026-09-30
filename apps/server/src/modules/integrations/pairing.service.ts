import {
  DEVICE_CREDENTIAL_PREFIX,
  normalizePairingKey,
  PAIRING_KEY_ALPHABET,
  PAIRING_KEY_GROUP_LENGTH,
  PAIRING_KEY_GROUPS,
  type CreatedPairingKeyDto,
  type ExtensionConfigDto,
  type pairDeviceSchema,
  type PairDeviceResponse,
  type PairingKeyDto,
} from '@devpulse/shared';
import type { PairingKey } from '@prisma/client';
import type { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../database/prisma';
import { hmacSha256, randomFromAlphabet, randomToken, sha256 } from '../../utils/crypto';
import { emitDomainEvent } from '../../utils/domain-events';
import { badRequest, notFound } from '../../utils/errors';

export const HEARTBEAT_INTERVAL_SECONDS = 60;
const INVALID_KEY_MESSAGE =
  'This connection key is invalid or has expired. Generate a new one in DevPulse.';

/** Keys are stored as a keyed hash so a database leak does not reveal usable keys. */
export function hashPairingKey(canonicalKey: string) {
  return hmacSha256(canonicalKey, env.PAIRING_SECRET);
}

export function generatePairingKey() {
  const groups = Array.from({ length: PAIRING_KEY_GROUPS }, () =>
    randomFromAlphabet(PAIRING_KEY_GROUP_LENGTH, PAIRING_KEY_ALPHABET),
  );
  return `DP-${groups.join('-')}`;
}

export function hashDeviceCredential(credential: string) {
  return sha256(credential);
}

function keyStatus(key: PairingKey, now = new Date()): PairingKeyDto['status'] {
  if (key.consumedAt) return 'used';
  if (key.revokedAt) return 'revoked';
  if (key.expiresAt <= now) return 'expired';
  return 'active';
}

function toKeyDto(
  key: PairingKey & { device: { id: string; name: string } | null },
): PairingKeyDto {
  return {
    id: key.id,
    hint: key.hint,
    status: keyStatus(key),
    createdAt: key.createdAt.toISOString(),
    expiresAt: key.expiresAt.toISOString(),
    consumedAt: key.consumedAt?.toISOString() ?? null,
    device: key.device,
  };
}

export async function extensionConfig(userId: string): Promise<ExtensionConfigDto> {
  const settings = await prisma.userSetting.findUnique({ where: { userId } });
  return {
    idleTimeoutMinutes: settings?.idleTimeoutMinutes ?? 5,
    trackBranchNames: settings?.trackBranchNames ?? true,
    trackRepositoryUrl: settings?.trackRepositoryUrl ?? true,
    heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
  };
}

export const pairingService = {
  /** Creates a single-use key, revoking any previous unused key for the user. */
  async createKey(userId: string): Promise<CreatedPairingKeyDto> {
    const key = generatePairingKey();
    const now = new Date();
    const record = await prisma.$transaction(async (tx) => {
      await tx.pairingKey.updateMany({
        where: { userId, consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      return tx.pairingKey.create({
        data: {
          userId,
          keyHash: hashPairingKey(key),
          hint: key.slice(-4),
          expiresAt: new Date(now.getTime() + env.PAIRING_KEY_TTL_MINUTES * 60_000),
        },
        include: { device: { select: { id: true, name: true } } },
      });
    });
    return { ...toKeyDto(record), key };
  },

  async listKeys(userId: string) {
    const keys = await prisma.pairingKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { device: { select: { id: true, name: true } } },
    });
    return keys.map(toKeyDto);
  },

  async revokeKey(userId: string, id: string) {
    const result = await prisma.pairingKey.updateMany({
      where: { id, userId, consumedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await prisma.pairingKey.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!exists) throw notFound('Connection key');
    }
  },

  /**
   * Exchanges a pairing key for a device credential. The key is consumed atomically, so a
   * key can pair at most one device even under concurrent attempts.
   */
  async pair(input: z.output<typeof pairDeviceSchema>): Promise<PairDeviceResponse> {
    const canonical = normalizePairingKey(input.key);
    if (!canonical)
      throw badRequest(INVALID_KEY_MESSAGE, [{ path: 'key', message: 'Invalid connection key' }]);

    const keyHash = hashPairingKey(canonical);
    const credential = `${DEVICE_CREDENTIAL_PREFIX}${randomToken(32)}`;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.pairingKey.updateMany({
        where: { keyHash, consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) return null;
      const key = await tx.pairingKey.findUniqueOrThrow({ where: { keyHash } });
      const device = await tx.device.create({
        data: {
          userId: key.userId,
          pairingKeyId: key.id,
          name: input.device.name,
          platform: input.device.platform ?? null,
          hostname: input.device.hostname ?? null,
          editor: input.device.editor ?? 'vscode',
          editorVersion: input.device.editorVersion ?? null,
          extensionVersion: input.device.extensionVersion ?? null,
          credentialHash: hashDeviceCredential(credential),
          credentialPrefix: credential.slice(0, DEVICE_CREDENTIAL_PREFIX.length + 6),
          lastSeenAt: now,
        },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: key.userId },
        select: { username: true, fullName: true },
      });
      return { device, user };
    });

    if (!result)
      throw badRequest(INVALID_KEY_MESSAGE, [
        { path: 'key', message: 'Invalid or expired connection key' },
      ]);

    await emitDomainEvent('device.connected', {
      userId: result.device.userId,
      deviceId: result.device.id,
      name: result.device.name,
    });
    return {
      credential,
      device: { id: result.device.id, name: result.device.name },
      account: result.user,
      config: await extensionConfig(result.device.userId),
    };
  },
};
