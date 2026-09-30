import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { resetDatabase } from './helpers/db';
import { registerUser } from './helpers/auth';

const app = createApp();
const HOUR = 3600;

beforeEach(resetDatabase);

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

async function logSession(auth: Record<string, string>, minutes: number) {
  const res = await request(app)
    .post('/api/v1/sessions')
    .set(auth)
    .send({ startedAt: ago(minutes * 60_000 + 60_000), endedAt: ago(60_000) });
  expect(res.status).toBe(201);
}

describe('notification producers', () => {
  it('notifies when a device is connected and revoked', async () => {
    const { auth } = await registerUser(app);
    const key = await request(app).post('/api/v1/integrations/pairing-keys').set(auth);
    const paired = await request(app)
      .post('/api/v1/integrations/pair')
      .send({ key: key.body.data.key, device: { name: 'Laptop' } });
    await request(app).delete(`/api/v1/devices/${paired.body.data.device.id}`).set(auth);

    const res = await request(app).get('/api/v1/notifications').set(auth);
    expect(res.body.data.map((n: { type: string }) => n.type)).toEqual([
      'DEVICE_REVOKED',
      'DEVICE_CONNECTED',
    ]);
    expect(res.body.data[1]).toMatchObject({
      title: 'New device connected',
      link: '/devices',
      read: false,
    });
    expect(res.body.meta.unread).toBe(2);
  });

  it('notifies on password changes', async () => {
    const { auth, input } = await registerUser(app);
    await request(app)
      .post('/api/v1/users/me/password')
      .set(auth)
      .send({
        currentPassword: input.password,
        newPassword: 'another-pass-99',
        confirmPassword: 'another-pass-99',
      });
    const res = await request(app).get('/api/v1/notifications').set(auth);
    expect(res.body.data[0]).toMatchObject({
      type: 'SECURITY',
      title: 'Your password was changed',
    });
  });

  it('sends one progress and one completion notice per goal per period', async () => {
    const { auth } = await registerUser(app);
    await request(app)
      .post('/api/v1/goals')
      .set(auth)
      .send({ metric: 'CODING_TIME', period: 'DAILY', target: HOUR, title: 'Daily hour' });

    await logSession(auth, 50); // 83%
    await logSession(auth, 5); // 92%: progress notice already sent
    await logSession(auth, 10); // 108%: completed
    await logSession(auth, 10); // still completed: no duplicate

    const res = await request(app).get('/api/v1/notifications').set(auth);
    const types = res.body.data.map((n: { type: string }) => n.type);
    expect(types.filter((type: string) => type === 'GOAL_PROGRESS')).toHaveLength(1);
    expect(types.filter((type: string) => type === 'GOAL_COMPLETED')).toHaveLength(1);
    expect(res.body.data.find((n: { type: string }) => n.type === 'GOAL_COMPLETED').title).toBe(
      'Daily hour reached',
    );
  });
});

describe('notification inbox', () => {
  it('marks notifications read, filters unread and deletes', async () => {
    const { auth, user } = await registerUser(app);
    await prisma.notification.createMany({
      data: [1, 2, 3].map((index) => ({
        userId: user.id,
        type: 'SYSTEM' as const,
        title: `Note ${index}`,
      })),
    });
    const all = await request(app).get('/api/v1/notifications').set(auth);
    const [first, second] = all.body.data;

    expect(
      (await request(app).patch(`/api/v1/notifications/${first.id}`).set(auth).send({ read: true }))
        .status,
    ).toBe(204);
    expect(
      (await request(app).get('/api/v1/notifications/unread-count').set(auth)).body.data.count,
    ).toBe(2);
    const unread = await request(app).get('/api/v1/notifications?unread=true').set(auth);
    expect(unread.body.data).toHaveLength(2);

    expect(
      (await request(app).post('/api/v1/notifications/read-all').set(auth)).body.data.updated,
    ).toBe(2);
    expect(
      (await request(app).get('/api/v1/notifications/unread-count').set(auth)).body.data.count,
    ).toBe(0);

    expect((await request(app).delete(`/api/v1/notifications/${second.id}`).set(auth)).status).toBe(
      204,
    );
    expect((await request(app).get('/api/v1/notifications').set(auth)).body.meta.total).toBe(2);
  });

  it('keeps notifications private', async () => {
    const owner = await registerUser(app);
    const intruder = await registerUser(app);
    const note = await prisma.notification.create({
      data: { userId: owner.user.id, type: 'SYSTEM', title: 'Private' },
    });
    expect(
      (
        await request(app)
          .patch(`/api/v1/notifications/${note.id}`)
          .set(intruder.auth)
          .send({ read: true })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).delete(`/api/v1/notifications/${note.id}`).set(intruder.auth)).status,
    ).toBe(404);
    expect(
      (await request(app).get('/api/v1/notifications').set(intruder.auth)).body.data,
    ).toHaveLength(0);
  });
});
