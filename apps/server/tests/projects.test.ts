import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { resetDatabase } from './helpers/db';
import { registerUser } from './helpers/auth';
import { insertSession } from './helpers/fixtures';

const app = createApp();

beforeEach(resetDatabase);

async function createProject(auth: Record<string, string>, body: Record<string, unknown>) {
  const res = await request(app).post('/api/v1/projects').set(auth).send(body);
  expect(res.status).toBe(201);
  return res.body.data as {
    id: string;
    slug: string;
    color: string;
    repositoryProvider: string | null;
  };
}

describe('project CRUD', () => {
  it('creates a project with a unique slug, detected provider and colour', async () => {
    const { auth } = await registerUser(app);
    const first = await createProject(auth, {
      name: 'Notes Saver',
      repositoryUrl: 'https://github.com/example/notes-saver.git',
      primaryLanguage: 'TypeScript',
    });
    const second = await createProject(auth, { name: 'Notes saver!' });

    expect(first.slug).toBe('notes-saver');
    expect(second.slug).toBe('notes-saver-2');
    expect(first.repositoryProvider).toBe('GITHUB');
    expect(first.color).not.toBe(second.color);

    const stored = await prisma.project.findUniqueOrThrow({ where: { id: first.id } });
    expect(stored.repositoryUrl).toBe('https://github.com/example/notes-saver');
    expect(stored.primaryLanguage).toBe('typescript');
  });

  it('validates input', async () => {
    const { auth } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/projects')
      .set(auth)
      .send({ name: '', repositoryUrl: 'ftp://nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((detail: { path: string }) => detail.path)).toEqual(
      expect.arrayContaining(['name', 'repositoryUrl']),
    );
  });

  it('updates, archives and deletes a project while keeping its sessions', async () => {
    const { auth, user } = await registerUser(app);
    const project = await createProject(auth, { name: 'PortPilot' });
    await insertSession({
      userId: user.id,
      projectId: project.id,
      startedAt: new Date(),
      durationSeconds: 600,
    });

    const updated = await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set(auth)
      .send({ name: 'Port Pilot', repositoryUrl: 'https://gitlab.com/x/y', archived: true });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      name: 'Port Pilot',
      slug: 'port-pilot',
      repositoryProvider: 'GITLAB',
    });
    expect(updated.body.data.archivedAt).not.toBeNull();

    const removed = await request(app).delete(`/api/v1/projects/${project.id}`).set(auth);
    expect(removed.status).toBe(204);
    expect(await prisma.project.count()).toBe(0);
    const orphan = await prisma.codingSession.findFirstOrThrow();
    expect(orphan.projectId).toBeNull();
  });
});

describe('project ownership', () => {
  it('hides other users projects behind 404s', async () => {
    const owner = await registerUser(app);
    const intruder = await registerUser(app);
    const project = await createProject(owner.auth, { name: 'Private' });

    for (const req of [
      request(app).get(`/api/v1/projects/${project.id}`),
      request(app).patch(`/api/v1/projects/${project.id}`).send({ name: 'Mine now' }),
      request(app).delete(`/api/v1/projects/${project.id}`),
    ]) {
      const res = await req.set(intruder.auth);
      expect(res.status).toBe(404);
    }
    const list = await request(app).get('/api/v1/projects').set(intruder.auth);
    expect(list.body.data).toHaveLength(0);
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).name).toBe(
      'Private',
    );
  });

  it('rejects malformed ids', async () => {
    const { auth } = await registerUser(app);
    expect((await request(app).get('/api/v1/projects/not-a-uuid').set(auth)).status).toBe(400);
  });
});

describe('project listing', () => {
  it('filters, sorts by total time and paginates', async () => {
    const { auth, user } = await registerUser(app);
    const a = await createProject(auth, { name: 'Alpha', primaryLanguage: 'typescript' });
    const b = await createProject(auth, { name: 'Bravo', primaryLanguage: 'cpp' });
    const c = await createProject(auth, { name: 'Charlie', primaryLanguage: 'typescript' });
    await insertSession({
      userId: user.id,
      projectId: b.id,
      startedAt: new Date(),
      durationSeconds: 3600,
    });
    await insertSession({
      userId: user.id,
      projectId: c.id,
      startedAt: new Date(),
      durationSeconds: 600,
    });
    await request(app).patch(`/api/v1/projects/${a.id}`).set(auth).send({ archived: true });

    const byTime = await request(app).get('/api/v1/projects?sort=time').set(auth);
    expect(byTime.body.data.map((p: { name: string }) => p.name)).toEqual(['Bravo', 'Charlie']);
    expect(byTime.body.data[0]).toMatchObject({ totalSeconds: 3600, sessionCount: 1 });

    const all = await request(app)
      .get('/api/v1/projects?status=all&language=typescript&sort=name')
      .set(auth);
    expect(all.body.data.map((p: { name: string }) => p.name)).toEqual(['Alpha', 'Charlie']);

    const search = await request(app).get('/api/v1/projects?search=rav').set(auth);
    expect(search.body.data.map((p: { name: string }) => p.name)).toEqual(['Bravo']);

    const paged = await request(app)
      .get('/api/v1/projects?status=all&sort=name&page=2&pageSize=2')
      .set(auth);
    expect(paged.body.meta).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    expect(paged.body.data.map((p: { name: string }) => p.name)).toEqual(['Charlie']);
  });

  it('treats search wildcards literally', async () => {
    const { auth } = await registerUser(app);
    await createProject(auth, { name: 'Plain' });
    const res = await request(app).get('/api/v1/projects?search=%25').set(auth);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });
});

describe('project detail', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports totals, language and device breakdowns and this weeks time', async () => {
    // A Wednesday afternoon (UTC), so "two hours ago" is always inside the current week.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T15:00:00Z'));
    const { auth, user } = await registerUser(app);
    const project = await createProject(auth, { name: 'DevPulse' });
    const device = await prisma.device.create({
      data: { userId: user.id, name: 'Laptop', credentialHash: 'h1', credentialPrefix: 'dpd_x' },
    });
    const now = Date.now();
    await insertSession({
      userId: user.id,
      projectId: project.id,
      deviceId: device.id,
      startedAt: new Date(now - 2 * 3600_000),
      durationSeconds: 3600,
      activeSeconds: 3000,
      language: 'typescript',
    });
    await insertSession({
      userId: user.id,
      projectId: project.id,
      startedAt: new Date(now - 60 * 86_400_000),
      durationSeconds: 1200,
      language: 'css',
    });

    const res = await request(app).get(`/api/v1/projects/${project.id}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ totalSeconds: 4200, sessionCount: 2, weekSeconds: 3000 });
    expect(res.body.data.languages).toEqual([
      { language: 'typescript', seconds: 3000 },
      { language: 'css', seconds: 1200 },
    ]);
    expect(res.body.data.devices).toEqual([{ id: device.id, name: 'Laptop', seconds: 3000 }]);
  });
});
