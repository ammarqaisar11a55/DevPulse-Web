import { ingestEventsSchema } from '@devpulse/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { activityService } from '../src/modules/activity/activity.service';
import { sessionsService } from '../src/modules/sessions/sessions.service';
import { onDomainEvent } from '../src/utils/domain-events';
import { resetDatabase } from './helpers/db';
import { registerUser } from './helpers/auth';
import { insertSession } from './helpers/fixtures';

const app = createApp();
const HOUR = 3600_000;

const recorded: string[] = [];
onDomainEvent('session.recorded', ({ sessionId }) => {
  recorded.push(sessionId);
});

beforeEach(async () => {
  await resetDatabase();
  recorded.length = 0;
});

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

async function createDevice(userId: string, name = 'Laptop') {
  return prisma.device.create({
    data: {
      userId,
      name,
      credentialHash: `hash-${name}-${Math.random()}`,
      credentialPrefix: 'dpd_test',
    },
  });
}

describe('manual sessions', () => {
  it('calculates duration, active and idle time', async () => {
    const { auth } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/sessions')
      .set(auth)
      .send({
        startedAt: iso(2 * HOUR),
        endedAt: iso(HOUR / 2),
        activeSeconds: 4000,
        language: 'TypeScript',
        title: 'Auth work',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      source: 'MANUAL',
      status: 'ENDED',
      durationSeconds: 5400,
      activeSeconds: 4000,
      idleSeconds: 1400,
      language: 'typescript',
      title: 'Auth work',
    });
    expect(recorded).toEqual([res.body.data.id]);
  });

  it('defaults active time to the full duration and clamps it to the duration', async () => {
    const { auth } = await registerUser(app);
    const defaulted = await request(app)
      .post('/api/v1/sessions')
      .set(auth)
      .send({ startedAt: iso(HOUR), endedAt: iso(0) });
    expect(defaulted.body.data).toMatchObject({
      durationSeconds: 3600,
      activeSeconds: 3600,
      idleSeconds: 0,
    });

    const clamped = await request(app)
      .post('/api/v1/sessions')
      .set(auth)
      .send({ startedAt: iso(HOUR), endedAt: iso(0), activeSeconds: 5000 });
    expect(clamped.body.data.activeSeconds).toBe(3600);
  });

  it('rejects impossible timings', async () => {
    const { auth } = await registerUser(app);
    const cases = [
      { startedAt: iso(0), endedAt: iso(HOUR) },
      { startedAt: iso(30 * HOUR), endedAt: iso(0) },
      { startedAt: iso(-2 * HOUR), endedAt: iso(-3 * HOUR) },
      { startedAt: iso(HOUR) },
    ];
    for (const body of cases) {
      const res = await request(app).post('/api/v1/sessions').set(auth).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('assigns projects, scales language breakdowns and bumps last activity', async () => {
    const { auth, user } = await registerUser(app);
    const project = await prisma.project.create({
      data: { userId: user.id, name: 'P', slug: 'p' },
    });
    const res = await request(app)
      .post('/api/v1/sessions')
      .set(auth)
      .send({
        startedAt: iso(HOUR),
        endedAt: iso(0),
        projectId: project.id,
        activeSeconds: 1800,
        languages: [
          { language: 'typescript', activeSeconds: 2400 },
          { language: 'css', activeSeconds: 1200 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.project).toMatchObject({ id: project.id, name: 'P' });
    expect(res.body.data.language).toBe('typescript');

    const detail = await request(app).get(`/api/v1/sessions/${res.body.data.id}`).set(auth);
    expect(detail.body.data.languages).toEqual([
      { language: 'typescript', activeSeconds: 1200 },
      { language: 'css', activeSeconds: 600 },
    ]);
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(stored.lastActivityAt).not.toBeNull();
  });
});

describe('session ownership', () => {
  it('refuses foreign projects and hides foreign sessions', async () => {
    const owner = await registerUser(app);
    const intruder = await registerUser(app);
    const project = await prisma.project.create({
      data: { userId: owner.user.id, name: 'Secret', slug: 'secret' },
    });
    const session = await insertSession({
      userId: owner.user.id,
      startedAt: new Date(Date.now() - HOUR),
      durationSeconds: 600,
    });

    const foreignProject = await request(app)
      .post('/api/v1/sessions')
      .set(intruder.auth)
      .send({ startedAt: iso(HOUR), endedAt: iso(0), projectId: project.id });
    expect(foreignProject.status).toBe(404);

    expect(
      (await request(app).get(`/api/v1/sessions/${session.id}`).set(intruder.auth)).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/v1/sessions/${session.id}`)
          .set(intruder.auth)
          .send({ title: 'x' })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).delete(`/api/v1/sessions/${session.id}`).set(intruder.auth)).status,
    ).toBe(404);
    expect((await request(app).get('/api/v1/sessions').set(intruder.auth)).body.meta.total).toBe(0);
  });
});

describe('session listing', () => {
  it('filters, sorts and paginates', async () => {
    const { auth, user } = await registerUser(app);
    const project = await prisma.project.create({
      data: { userId: user.id, name: 'P', slug: 'p' },
    });
    await insertSession({
      userId: user.id,
      projectId: project.id,
      startedAt: new Date(Date.now() - 3 * HOUR),
      durationSeconds: 600,
      language: 'python',
    });
    await insertSession({
      userId: user.id,
      startedAt: new Date(Date.now() - 2 * HOUR),
      durationSeconds: 1800,
    });
    await insertSession({
      userId: user.id,
      startedAt: new Date(Date.now() - 10 * 24 * HOUR),
      durationSeconds: 300,
    });

    const byProject = await request(app).get(`/api/v1/sessions?projectId=${project.id}`).set(auth);
    expect(byProject.body.data).toHaveLength(1);
    const unassigned = await request(app).get('/api/v1/sessions?projectId=none').set(auth);
    expect(unassigned.body.meta.total).toBe(2);
    const python = await request(app).get('/api/v1/sessions?language=Python').set(auth);
    expect(python.body.data).toHaveLength(1);
    const recent = await request(app)
      .get(`/api/v1/sessions?from=${encodeURIComponent(iso(24 * HOUR))}`)
      .set(auth);
    expect(recent.body.meta.total).toBe(2);
    const longest = await request(app)
      .get('/api/v1/sessions?sort=longest&pageSize=1&page=1')
      .set(auth);
    expect(longest.body.data[0].activeSeconds).toBe(1800);
    expect(longest.body.meta).toMatchObject({ total: 3, totalPages: 3 });
  });

  it('lets users rename, reassign and delete sessions', async () => {
    const { auth, user } = await registerUser(app);
    const project = await prisma.project.create({
      data: { userId: user.id, name: 'P', slug: 'p' },
    });
    const session = await insertSession({
      userId: user.id,
      startedAt: new Date(Date.now() - HOUR),
      durationSeconds: 600,
    });

    const res = await request(app)
      .patch(`/api/v1/sessions/${session.id}`)
      .set(auth)
      .send({ title: 'Refactor', projectId: project.id });
    expect(res.body.data).toMatchObject({ title: 'Refactor', project: { id: project.id } });
    expect((await request(app).delete(`/api/v1/sessions/${session.id}`).set(auth)).status).toBe(
      204,
    );
    expect(await prisma.codingSession.count()).toBe(0);
  });
});

describe('editor-recorded sessions', () => {
  it('starts, heartbeats and ends a session', async () => {
    const { user } = await registerUser(app);
    const device = await createDevice(user.id);
    const actor = { userId: user.id, deviceId: device.id };
    const start = new Date(Date.now() - HOUR);

    const { session } = await sessionsService.create(actor, {
      startedAt: start,
      clientSessionId: 'abc',
      language: 'typescript',
    });
    expect(session).toMatchObject({
      status: 'ACTIVE',
      source: 'EXTENSION',
      durationSeconds: 0,
      activeSeconds: 0,
    });

    const beat = await sessionsService.update(actor, session.id, {
      lastHeartbeatAt: new Date(start.getTime() + 30 * 60_000),
      activeSeconds: 1500,
    });
    expect(beat).toMatchObject({
      status: 'ACTIVE',
      durationSeconds: 1800,
      activeSeconds: 1500,
      idleSeconds: 300,
    });
    expect(recorded).toHaveLength(0);

    const endedAt = new Date(start.getTime() + 40 * 60_000);
    const ended = await sessionsService.update(actor, session.id, {
      endedAt,
      activeSeconds: 2000,
      commits: 2,
    });
    expect(ended).toMatchObject({
      status: 'ENDED',
      durationSeconds: 2400,
      activeSeconds: 2000,
      idleSeconds: 400,
      commits: 2,
    });
    expect(recorded).toEqual([session.id]);

    // Retrying the same completion is harmless; changing it is a conflict.
    await expect(sessionsService.update(actor, session.id, { endedAt })).resolves.toMatchObject({
      status: 'ENDED',
    });
    await expect(
      sessionsService.update(actor, session.id, { activeSeconds: 10 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('deduplicates retried session starts by client id', async () => {
    const { user } = await registerUser(app);
    const device = await createDevice(user.id);
    const actor = { userId: user.id, deviceId: device.id };
    const input = { startedAt: new Date(Date.now() - 60_000), clientSessionId: 'retry-me' };
    const first = await sessionsService.create(actor, input);
    const second = await sessionsService.create(actor, input);
    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);
    expect(await prisma.codingSession.count()).toBe(1);
  });

  it('prevents a device from touching another device session', async () => {
    const { user } = await registerUser(app);
    const laptop = await createDevice(user.id, 'Laptop');
    const desktop = await createDevice(user.id, 'Desktop');
    const { session } = await sessionsService.create(
      { userId: user.id, deviceId: laptop.id },
      { startedAt: new Date() },
    );
    await expect(
      sessionsService.update({ userId: user.id, deviceId: desktop.id }, session.id, {
        activeSeconds: 5,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('resolves projects from workspace details', async () => {
    const { user } = await registerUser(app);
    const device = await createDevice(user.id);
    const actor = { userId: user.id, deviceId: device.id };
    const project = { name: 'PortPilot', repositoryUrl: 'https://github.com/me/portpilot' };

    const first = await sessionsService.create(actor, {
      startedAt: new Date(Date.now() - 120_000),
      project,
    });
    const second = await sessionsService.create(actor, {
      startedAt: new Date(Date.now() - 60_000),
      project: { name: 'portpilot' },
    });
    expect(first.session.project?.name).toBe('PortPilot');
    expect(second.session.project?.id).toBe(first.session.project?.id);
    expect(await prisma.project.count()).toBe(1);
  });

  it('closes sessions that stopped sending heartbeats', async () => {
    const { user } = await registerUser(app);
    const device = await createDevice(user.id);
    const actor = { userId: user.id, deviceId: device.id };
    const start = new Date(Date.now() - 3 * HOUR);
    const { session } = await sessionsService.create(actor, { startedAt: start });
    await sessionsService.update(actor, session.id, {
      lastHeartbeatAt: new Date(start.getTime() + 20 * 60_000),
      activeSeconds: 900,
    });

    expect(await sessionsService.closeStaleSessions()).toBe(1);
    const closed = await prisma.codingSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(closed).toMatchObject({ status: 'ENDED', durationSeconds: 1200, activeSeconds: 900 });
    expect(recorded).toEqual([session.id]);
  });
});

describe('activity timeline', () => {
  it('pages through sessions with a cursor', async () => {
    const { auth, user } = await registerUser(app);
    for (let index = 0; index < 5; index += 1) {
      await insertSession({
        userId: user.id,
        startedAt: new Date(Date.now() - (index + 1) * HOUR),
        durationSeconds: 300,
      });
    }
    const first = await request(app).get('/api/v1/activity/timeline?limit=2').set(auth);
    expect(first.body.data).toHaveLength(2);
    const second = await request(app)
      .get(`/api/v1/activity/timeline?limit=2&cursor=${first.body.nextCursor}`)
      .set(auth);
    const third = await request(app)
      .get(`/api/v1/activity/timeline?limit=2&cursor=${second.body.nextCursor}`)
      .set(auth);
    expect(third.body.data).toHaveLength(1);
    expect(third.body.nextCursor).toBeNull();

    const ids = [...first.body.data, ...second.body.data, ...third.body.data].map(
      (row: { id: string }) => row.id,
    );
    expect(new Set(ids).size).toBe(5);
    expect(
      (await request(app).get('/api/v1/activity/timeline?cursor=garbage').set(auth)).status,
    ).toBe(400);
  });

  it('lists filter options from the users data', async () => {
    const { auth, user } = await registerUser(app);
    await insertSession({
      userId: user.id,
      startedAt: new Date(),
      durationSeconds: 60,
      language: 'rust',
    });
    const res = await request(app).get('/api/v1/activity/filters').set(auth);
    expect(res.body.data.languages).toEqual(['rust']);
  });
});

describe('activity events', () => {
  it('rejects metadata outside the privacy allow-list', () => {
    const parsed = ingestEventsSchema.safeParse({
      events: [
        {
          type: 'FILE_CHANGED',
          occurredAt: new Date().toISOString(),
          metadata: { content: 'const secret = 1' },
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('stores events, deduplicates retries and checks ownership', async () => {
    const { user } = await registerUser(app);
    const other = await registerUser(app);
    const device = await createDevice(user.id);
    const actor = { userId: user.id, deviceId: device.id };
    const { session } = await sessionsService.create(actor, {
      startedAt: new Date(Date.now() - 60_000),
    });

    const batch = ingestEventsSchema.parse({
      events: [
        {
          clientEventId: 'e1',
          type: 'FILE_CHANGED',
          occurredAt: new Date().toISOString(),
          sessionId: session.id,
          metadata: { fileExtension: '.ts', linesAdded: 3 },
        },
        {
          clientEventId: 'e2',
          type: 'GIT_COMMIT',
          occurredAt: new Date().toISOString(),
          sessionId: session.id,
        },
      ],
    });
    expect(await activityService.ingestEvents(actor, batch)).toEqual({
      accepted: 2,
      duplicates: 0,
    });
    expect(await activityService.ingestEvents(actor, batch)).toEqual({
      accepted: 0,
      duplicates: 2,
    });

    const detail = await sessionsService.get(actor, session.id);
    expect(detail.events).toHaveLength(2);

    await expect(
      activityService.ingestEvents({ userId: other.user.id }, batch),
    ).rejects.toMatchObject({ status: 404 });
  });
});
