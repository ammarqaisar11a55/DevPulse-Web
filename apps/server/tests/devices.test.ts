import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { resetDatabase } from './helpers/db';
import { registerUser } from './helpers/auth';
import { insertSession } from './helpers/fixtures';

const app = createApp();

beforeEach(resetDatabase);

async function pairDevice(auth: Record<string, string>, name = 'Ubuntu Laptop') {
  const key = await request(app).post('/api/v1/integrations/pairing-keys').set(auth);
  const res = await request(app)
    .post('/api/v1/integrations/pair')
    .send({
      key: key.body.data.key,
      device: { name, platform: 'linux', hostname: 'private-host.local' },
    });
  return { id: res.body.data.device.id as string, credential: res.body.data.credential as string };
}

describe('devices', () => {
  it('lists devices with usage and without sensitive machine details', async () => {
    const { auth, user } = await registerUser(app);
    const laptop = await pairDevice(auth);
    await insertSession({
      userId: user.id,
      deviceId: laptop.id,
      startedAt: new Date(Date.now() - 3600_000),
      durationSeconds: 1200,
    });

    const res = await request(app).get('/api/v1/devices').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: laptop.id,
      name: 'Ubuntu Laptop',
      platform: 'linux',
      totalSeconds: 1200,
      sessionCount: 1,
      revokedAt: null,
    });
    expect(res.body.data[0].credentialPrefix).toMatch(/^dpd_/);
    expect(JSON.stringify(res.body)).not.toContain('private-host.local');
    expect(JSON.stringify(res.body)).not.toContain(laptop.credential);
  });

  it('renames a device', async () => {
    const { auth } = await registerUser(app);
    const laptop = await pairDevice(auth);
    const res = await request(app)
      .patch(`/api/v1/devices/${laptop.id}`)
      .set(auth)
      .send({ name: 'Work laptop' });
    expect(res.body.data.name).toBe('Work laptop');
    expect(
      (await request(app).patch(`/api/v1/devices/${laptop.id}`).set(auth).send({ name: '' }))
        .status,
    ).toBe(400);
  });

  it('revokes a device so its credential stops working, keeping its history', async () => {
    const { auth, user } = await registerUser(app);
    const laptop = await pairDevice(auth);
    const deviceAuth = { Authorization: `Bearer ${laptop.credential}` };
    const started = await request(app)
      .post('/api/v1/activity/sessions')
      .set(deviceAuth)
      .send({ startedAt: new Date(Date.now() - 600_000).toISOString() });

    expect((await request(app).delete(`/api/v1/devices/${laptop.id}`).set(auth)).status).toBe(204);
    expect(
      (await request(app).get('/api/v1/integrations/extension/config').set(deviceAuth)).status,
    ).toBe(401);

    const device = await request(app).get(`/api/v1/devices/${laptop.id}`).set(auth);
    expect(device.body.data.revokedAt).not.toBeNull();
    const session = await prisma.codingSession.findUniqueOrThrow({
      where: { id: started.body.data.id },
    });
    expect(session).toMatchObject({ status: 'ENDED', deviceId: laptop.id, userId: user.id });

    // Revoking again is harmless.
    expect((await request(app).delete(`/api/v1/devices/${laptop.id}`).set(auth)).status).toBe(204);
  });

  it('enforces ownership', async () => {
    const owner = await registerUser(app);
    const intruder = await registerUser(app);
    const laptop = await pairDevice(owner.auth);
    for (const req of [
      request(app).get(`/api/v1/devices/${laptop.id}`),
      request(app).patch(`/api/v1/devices/${laptop.id}`).send({ name: 'Mine' }),
      request(app).delete(`/api/v1/devices/${laptop.id}`),
    ]) {
      expect((await req.set(intruder.auth)).status).toBe(404);
    }
    expect((await request(app).get('/api/v1/devices').set(intruder.auth)).body.data).toHaveLength(
      0,
    );
    const stillWorks = await request(app)
      .get('/api/v1/integrations/extension/config')
      .set('Authorization', `Bearer ${laptop.credential}`);
    expect(stillWorks.status).toBe(200);
  });
});
