import { normalizePairingKey } from '@devpulse/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { resetDatabase } from './helpers/db';
import { registerUser } from './helpers/auth';

const app = createApp();
const DEVICE = {
  name: 'Ubuntu Laptop',
  platform: 'linux',
  editorVersion: '1.104.0',
  extensionVersion: '0.1.0',
};

beforeEach(resetDatabase);

async function createKey(auth: Record<string, string>) {
  const res = await request(app).post('/api/v1/integrations/pairing-keys').set(auth);
  expect(res.status).toBe(201);
  return res.body.data as {
    id: string;
    key: string;
    hint: string;
    status: string;
    expiresAt: string;
  };
}

async function pair(key: string) {
  return request(app).post('/api/v1/integrations/pair').send({ key, device: DEVICE });
}

async function pairedDevice() {
  const owner = await registerUser(app);
  const { key } = await createKey(owner.auth);
  const res = await pair(key);
  return {
    owner,
    credential: res.body.data.credential as string,
    deviceId: res.body.data.device.id as string,
  };
}

describe('pairing keys', () => {
  it('generates a formatted, short-lived key stored only as a hash', async () => {
    const { auth } = await registerUser(app);
    const created = await createKey(auth);
    expect(created.key).toMatch(/^DP(-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}){3}$/);
    expect(created.hint).toBe(created.key.slice(-4));
    expect(created.status).toBe('active');
    const ttl = new Date(created.expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(9 * 60_000);
    expect(ttl).toBeLessThanOrEqual(10 * 60_000);

    const stored = await prisma.pairingKey.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.keyHash).not.toContain(created.key.replace(/-/g, ''));
    const list = await request(app).get('/api/v1/integrations/pairing-keys').set(auth);
    expect(JSON.stringify(list.body)).not.toContain(created.key);
  });

  it('revokes the previous unused key when a new one is generated', async () => {
    const { auth } = await registerUser(app);
    const first = await createKey(auth);
    await createKey(auth);
    expect((await pair(first.key)).status).toBe(400);
    const list = await request(app).get('/api/v1/integrations/pairing-keys').set(auth);
    expect(list.body.data.map((key: { status: string }) => key.status)).toEqual([
      'active',
      'revoked',
    ]);
  });

  it('normalises how users type keys', () => {
    expect(normalizePairingKey('dp-7f3k-x92m-q8pr')).toBe('DP-7F3K-X92M-Q8PR');
    expect(normalizePairingKey(' 7F3K X92M Q8PR ')).toBe('DP-7F3K-X92M-Q8PR');
    expect(normalizePairingKey('DP-7F3K-X92M-Q8PL')).toBeNull(); // L is excluded (looks like 1)
    expect(normalizePairingKey('DP-7F3K-X92M-Q8P0')).toBeNull(); // 0 is not in the alphabet
    expect(normalizePairingKey('DP-7F3K')).toBeNull();
  });
});

describe('pairing', () => {
  it('pairs a device and issues a working credential', async () => {
    const { auth, user } = await registerUser(app);
    const { key } = await createKey(auth);
    const res = await pair(key.toLowerCase());

    expect(res.status).toBe(201);
    expect(res.body.data.credential).toMatch(/^dpd_/);
    expect(res.body.data.account).toEqual({ username: user.username, fullName: 'Ada Lovelace' });
    expect(res.body.data.config).toMatchObject({
      idleTimeoutMinutes: 5,
      trackBranchNames: true,
      heartbeatIntervalSeconds: 60,
    });
    expect(res.headers['cache-control']).toBe('no-store');

    const device = await prisma.device.findUniqueOrThrow({
      where: { id: res.body.data.device.id },
    });
    expect(device).toMatchObject({ userId: user.id, name: 'Ubuntu Laptop', platform: 'linux' });
    expect(device.credentialHash).not.toBe(res.body.data.credential);

    const config = await request(app)
      .get('/api/v1/integrations/extension/config')
      .set('Authorization', `Bearer ${res.body.data.credential}`);
    expect(config.status).toBe(200);
    expect(config.body.data.device.name).toBe('Ubuntu Laptop');
  });

  it('is single-use', async () => {
    const { auth } = await registerUser(app);
    const { key } = await createKey(auth);
    const results = await Promise.all([pair(key), pair(key), pair(key)]);
    expect(results.filter((res) => res.status === 201)).toHaveLength(1);
    expect(await prisma.device.count()).toBe(1);
  });

  it('rejects expired, revoked and unknown keys with the same message', async () => {
    const { auth } = await registerUser(app);
    const expired = await createKey(auth);
    await prisma.pairingKey.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expiredRes = await pair(expired.key);

    const revoked = await createKey(auth);
    expect(
      (await request(app).delete(`/api/v1/integrations/pairing-keys/${revoked.id}`).set(auth))
        .status,
    ).toBe(204);
    const revokedRes = await pair(revoked.key);

    const unknownRes = await pair('DP-AAAA-BBBB-CCCC');
    const malformed = await pair('not-a-key');

    for (const res of [expiredRes, revokedRes, unknownRes, malformed]) {
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(expiredRes.body.error.message);
    }
    expect(await prisma.device.count()).toBe(0);
  });

  it('does not let users revoke other users keys', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const { id } = await createKey(owner.auth);
    expect(
      (await request(app).delete(`/api/v1/integrations/pairing-keys/${id}`).set(other.auth)).status,
    ).toBe(404);
  });

  it('rate limits pairing attempts', async () => {
    process.env.ENABLE_RATE_LIMIT_IN_TESTS = 'true';
    try {
      const statuses = [];
      for (let attempt = 0; attempt < 11; attempt += 1)
        statuses.push((await pair('DP-AAAA-BBBB-CCCC')).status);
      expect(statuses.slice(0, 10).every((status) => status === 400)).toBe(true);
      expect(statuses[10]).toBe(429);
    } finally {
      delete process.env.ENABLE_RATE_LIMIT_IN_TESTS;
    }
  });
});

describe('device-authenticated ingestion', () => {
  afterEach(() => {
    delete process.env.ENABLE_RATE_LIMIT_IN_TESTS;
  });

  it('records a full session lifecycle from the extension', async () => {
    const { owner, credential, deviceId } = await pairedDevice();
    const auth = { Authorization: `Bearer ${credential}` };
    const startedAt = new Date(Date.now() - 30 * 60_000);

    const start = await request(app)
      .post('/api/v1/activity/sessions')
      .set(auth)
      .send({
        clientSessionId: 's-1',
        startedAt: startedAt.toISOString(),
        project: { name: 'Notes Saver' },
        language: 'typescript',
        branch: 'main',
      });
    expect(start.status).toBe(201);
    expect(start.body.data).toMatchObject({
      source: 'EXTENSION',
      status: 'ACTIVE',
      device: { id: deviceId },
    });

    const retry = await request(app)
      .post('/api/v1/activity/sessions')
      .set(auth)
      .send({ clientSessionId: 's-1', startedAt: startedAt.toISOString() });
    expect(retry.status).toBe(200);
    expect(retry.body.data.id).toBe(start.body.data.id);

    const events = await request(app)
      .post('/api/v1/activity/events')
      .set(auth)
      .send({
        events: [
          {
            clientEventId: 'e-1',
            type: 'FILE_CHANGED',
            occurredAt: new Date().toISOString(),
            sessionId: start.body.data.id,
            metadata: { fileExtension: '.ts' },
          },
        ],
      });
    expect(events.status).toBe(202);
    expect(events.body.data).toEqual({ accepted: 1, duplicates: 0 });

    const end = await request(app)
      .patch(`/api/v1/activity/sessions/${start.body.data.id}`)
      .set(auth)
      .send({ endedAt: new Date().toISOString(), activeSeconds: 1500 });
    expect(end.status).toBe(200);
    expect(end.body.data).toMatchObject({ status: 'ENDED', activeSeconds: 1500 });

    const listed = await request(app).get('/api/v1/sessions').set(owner.auth);
    expect(listed.body.data[0]).toMatchObject({
      id: start.body.data.id,
      project: { name: 'Notes Saver' },
    });
  });

  it('rejects user tokens, unknown credentials and revoked devices', async () => {
    const { owner, credential, deviceId } = await pairedDevice();
    const body = { startedAt: new Date().toISOString() };
    expect(
      (await request(app).post('/api/v1/activity/sessions').set(owner.auth).send(body)).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/activity/sessions')
          .set('Authorization', 'Bearer dpd_bogus')
          .send(body)
      ).status,
    ).toBe(401);

    await prisma.device.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });
    const revoked = await request(app)
      .post('/api/v1/activity/sessions')
      .set('Authorization', `Bearer ${credential}`)
      .send(body);
    expect(revoked.status).toBe(401);
  });

  it('drops branch and repository data when the user has disabled them', async () => {
    const { owner, credential } = await pairedDevice();
    await request(app)
      .patch('/api/v1/users/me/settings')
      .set(owner.auth)
      .send({ trackBranchNames: false, trackRepositoryUrl: false });
    const res = await request(app)
      .post('/api/v1/activity/sessions')
      .set('Authorization', `Bearer ${credential}`)
      .send({
        startedAt: new Date(Date.now() - 60_000).toISOString(),
        endedAt: new Date().toISOString(),
        branch: 'feature/secret-client',
        repository: 'github.com/acme/secret',
        project: { name: 'Acme', repositoryUrl: 'https://github.com/acme/secret' },
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ branch: null, repository: null });
    const project = await prisma.project.findFirstOrThrow({ where: { name: 'Acme' } });
    expect(project.repositoryUrl).toBeNull();
  });

  it('lets a device disconnect itself', async () => {
    const { credential, deviceId } = await pairedDevice();
    const auth = { Authorization: `Bearer ${credential}` };
    expect(
      (await request(app).post('/api/v1/integrations/extension/disconnect').set(auth)).status,
    ).toBe(204);
    expect(
      (await prisma.device.findUniqueOrThrow({ where: { id: deviceId } })).revokedAt,
    ).not.toBeNull();
    expect((await request(app).get('/api/v1/integrations/extension/config').set(auth)).status).toBe(
      401,
    );
  });

  it('lets a device rename itself', async () => {
    const { owner, credential, deviceId } = await pairedDevice();
    const auth = { Authorization: `Bearer ${credential}` };
    const res = await request(app)
      .patch('/api/v1/integrations/extension/device')
      .set(auth)
      .send({ name: '  Work Laptop ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: deviceId, name: 'Work Laptop' });

    const listed = await request(app).get('/api/v1/devices').set(owner.auth);
    expect(listed.body.data[0].name).toBe('Work Laptop');

    const invalid = await request(app)
      .patch('/api/v1/integrations/extension/device')
      .set(auth)
      .send({ name: '' });
    expect(invalid.status).toBe(400);
    expect(
      (
        await request(app)
          .patch('/api/v1/integrations/extension/device')
          .set(owner.auth)
          .send({ name: 'x' })
      ).status,
    ).toBe(401);
  });

  it("reports the account's coding time today and this week", async () => {
    const { credential } = await pairedDevice();
    const auth = { Authorization: `Bearer ${credential}` };
    const startedAt = new Date(Date.now() - 30 * 60_000);
    await request(app)
      .post('/api/v1/activity/sessions')
      .set(auth)
      .send({
        clientSessionId: 'summary-1',
        startedAt: startedAt.toISOString(),
        endedAt: new Date(startedAt.getTime() + 20 * 60_000).toISOString(),
        activeSeconds: 900,
      })
      .expect(201);

    const res = await request(app).get('/api/v1/integrations/extension/summary').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ timezone: expect.any(String) });
    expect(res.body.data.weekSeconds).toBeGreaterThanOrEqual(res.body.data.todaySeconds);
    // 900 s, unless a day or week boundary fell inside the last half hour.
    expect(res.body.data.weekSeconds).toBeGreaterThan(0);
    expect(res.body.data.weekSeconds).toBeLessThanOrEqual(900);

    expect((await request(app).get('/api/v1/integrations/extension/summary')).status).toBe(401);
  });
});
