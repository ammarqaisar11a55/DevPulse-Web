import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { resetDatabase } from './helpers/db';
import { registerUser } from './helpers/auth';
import { insertSession } from './helpers/fixtures';

const app = createApp();

beforeEach(resetDatabase);

async function fixtures(userId: string) {
  const project = await prisma.project.create({
    data: {
      userId,
      name: 'Notes Saver',
      slug: 'notes-saver',
      repositoryUrl: 'https://github.com/me/notes-saver',
    },
  });
  const session = await insertSession({
    userId,
    projectId: project.id,
    startedAt: new Date(Date.now() - 3600_000),
    durationSeconds: 600,
  });
  await prisma.codingSession.update({
    where: { id: session.id },
    data: { title: 'Notes sync engine', branch: 'feature/notes-sync' },
  });
  await prisma.device.create({
    data: {
      userId,
      name: 'Notes laptop',
      credentialHash: `h-${userId}`,
      credentialPrefix: 'dpd_x',
    },
  });
  return { project, session };
}

describe('global search', () => {
  it('searches projects, sessions and devices in one request', async () => {
    const { auth, user } = await registerUser(app);
    const { project, session } = await fixtures(user.id);

    const res = await request(app).get('/api/v1/search?q=notes').set(auth);
    expect(res.status).toBe(200);
    const byType = Object.fromEntries(
      res.body.data.groups.map((group: { type: string }) => [group.type, group]),
    );
    expect(byType.projects.results[0]).toMatchObject({
      id: project.id,
      title: 'Notes Saver',
      href: `/projects/${project.id}`,
    });
    expect(byType.sessions.results[0]).toMatchObject({
      id: session.id,
      title: 'Notes sync engine',
      subtitle: 'Notes Saver',
    });
    expect(byType.devices.results[0]).toMatchObject({ title: 'Notes laptop', href: '/devices' });
  });

  it('only returns the callers data', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    await fixtures(owner.user.id);
    const res = await request(app).get('/api/v1/search?q=notes').set(other.auth);
    expect(res.body.data.groups.every((group: { total: number }) => group.total === 0)).toBe(true);
  });

  it('treats wildcards literally and paginates a single type', async () => {
    const { auth, user } = await registerUser(app);
    for (let index = 0; index < 7; index += 1) {
      await prisma.project.create({
        data: { userId: user.id, name: `Service ${index}`, slug: `service-${index}` },
      });
    }
    await prisma.project.create({
      data: { userId: user.id, name: '100% coverage', slug: 'coverage' },
    });

    const literal = await request(app).get('/api/v1/search?q=0%25&type=projects').set(auth);
    expect(literal.body.data.groups[0].results.map((r: { title: string }) => r.title)).toEqual([
      '100% coverage',
    ]);

    const pageTwo = await request(app)
      .get('/api/v1/search?q=service&type=projects&pageSize=5&page=2')
      .set(auth);
    expect(pageTwo.body.data.groups[0]).toMatchObject({ type: 'projects', total: 7 });
    expect(pageTwo.body.data.groups[0].results).toHaveLength(2);
  });

  it('validates the query', async () => {
    const { auth } = await registerUser(app);
    expect((await request(app).get('/api/v1/search?q=a').set(auth)).status).toBe(400);
    expect((await request(app).get('/api/v1/search?q=ab&type=users').set(auth)).status).toBe(400);
    expect((await request(app).get('/api/v1/search?q=ab')).status).toBe(401);
  });
});
