import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { goalWindow } from '../src/modules/goals/goals.service';
import { resetDatabase } from './helpers/db';
import { registerUser } from './helpers/auth';
import { insertSession } from './helpers/fixtures';

const app = createApp();
const HOUR = 3600;
const NOW = new Date('2026-09-30T12:00:00Z'); // Wednesday

beforeEach(async () => {
  await resetDatabase();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('goal windows', () => {
  it('follows the user calendar', () => {
    const calendar = { timezone: 'UTC', weekStartsOn: 1 };
    expect(goalWindow('DAILY', calendar, NOW)).toEqual({
      start: new Date('2026-09-30T00:00:00Z'),
      end: new Date('2026-10-01T00:00:00Z'),
    });
    expect(goalWindow('WEEKLY', calendar, NOW)).toEqual({
      start: new Date('2026-09-28T00:00:00Z'),
      end: new Date('2026-10-05T00:00:00Z'),
    });
    expect(goalWindow('WEEKLY', { timezone: 'UTC', weekStartsOn: 0 }, NOW).start).toEqual(
      new Date('2026-09-27T00:00:00Z'),
    );
    expect(goalWindow('MONTHLY', calendar, NOW)).toEqual({
      start: new Date('2026-09-01T00:00:00Z'),
      end: new Date('2026-10-01T00:00:00Z'),
    });
    expect(goalWindow('MONTHLY', calendar, new Date('2026-12-15T00:00:00Z')).end).toEqual(
      new Date('2027-01-01T00:00:00Z'),
    );
  });
});

describe('goals', () => {
  it('creates goals and reports progress for the current period', async () => {
    const { auth, user } = await registerUser(app);
    await insertSession({
      userId: user.id,
      startedAt: new Date('2026-09-28T09:00:00Z'),
      durationSeconds: 2 * HOUR,
    });
    await insertSession({
      userId: user.id,
      startedAt: new Date('2026-09-30T09:00:00Z'),
      durationSeconds: HOUR,
    });
    await insertSession({
      userId: user.id,
      startedAt: new Date('2026-09-20T09:00:00Z'),
      durationSeconds: 5 * HOUR,
    }); // last week

    const weekly = await request(app)
      .post('/api/v1/goals')
      .set(auth)
      .send({ metric: 'CODING_TIME', period: 'WEEKLY', target: 10 * HOUR });
    expect(weekly.status).toBe(201);
    expect(weekly.body.data.progress).toMatchObject({
      current: 3 * HOUR,
      target: 10 * HOUR,
      ratio: 0.3,
      completed: false,
    });

    await request(app)
      .post('/api/v1/goals')
      .set(auth)
      .send({ metric: 'SESSIONS', period: 'DAILY', target: 1 });
    const list = await request(app).get('/api/v1/goals').set(auth);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data[1].progress).toMatchObject({ current: 1, completed: true });
  });

  it('scopes progress to a project', async () => {
    const { auth, user } = await registerUser(app);
    const project = await prisma.project.create({
      data: { userId: user.id, name: 'P', slug: 'p' },
    });
    await insertSession({
      userId: user.id,
      projectId: project.id,
      startedAt: new Date('2026-09-30T08:00:00Z'),
      durationSeconds: HOUR,
    });
    await insertSession({
      userId: user.id,
      startedAt: new Date('2026-09-30T10:00:00Z'),
      durationSeconds: HOUR,
    });
    const res = await request(app)
      .post('/api/v1/goals')
      .set(auth)
      .send({ metric: 'CODING_TIME', period: 'DAILY', target: 2 * HOUR, projectId: project.id });
    expect(res.body.data).toMatchObject({
      project: { id: project.id },
      progress: { current: HOUR, ratio: 0.5 },
    });
  });

  it('validates targets and limits', async () => {
    const { auth } = await registerUser(app);
    for (const body of [
      { metric: 'CODING_TIME', period: 'DAILY', target: 25 * HOUR },
      { metric: 'CODING_TIME', period: 'DAILY', target: 30 },
      { metric: 'SESSIONS', period: 'WEEKLY', target: 0 },
      { metric: 'LINES', period: 'WEEKLY', target: 5 },
    ]) {
      expect(
        (await request(app).post('/api/v1/goals').set(auth).send(body)).status,
        JSON.stringify(body),
      ).toBe(400);
    }
  });

  it('updates, archives and deletes goals with ownership checks', async () => {
    const owner = await registerUser(app);
    const intruder = await registerUser(app);
    const created = await request(app)
      .post('/api/v1/goals')
      .set(owner.auth)
      .send({ metric: 'SESSIONS', period: 'MONTHLY', target: 20 });
    const id = created.body.data.id;

    expect(
      (await request(app).patch(`/api/v1/goals/${id}`).set(intruder.auth).send({ target: 1 }))
        .status,
    ).toBe(404);
    expect((await request(app).delete(`/api/v1/goals/${id}`).set(intruder.auth)).status).toBe(404);

    const archived = await request(app)
      .patch(`/api/v1/goals/${id}`)
      .set(owner.auth)
      .send({ archived: true, target: 30 });
    expect(archived.body.data).toMatchObject({ target: 30 });
    expect(archived.body.data.archivedAt).not.toBeNull();
    expect((await request(app).get('/api/v1/goals').set(owner.auth)).body.data).toHaveLength(0);
    expect(
      (await request(app).get('/api/v1/goals?archived=true').set(owner.auth)).body.data,
    ).toHaveLength(1);

    expect((await request(app).delete(`/api/v1/goals/${id}`).set(owner.auth)).status).toBe(204);
  });
});
