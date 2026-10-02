import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/database/prisma';
import { registerUser } from './helpers/auth';
import { resetDatabase } from './helpers/db';

const app = createApp();
const PATH = '/api/v1/internal/cron/close-stale-sessions';
const SECRET = 'cron-secret-for-tests';

beforeEach(resetDatabase);
afterEach(() => {
  env.CRON_SECRET = '';
});

describe('cron endpoints', () => {
  it('are disabled while CRON_SECRET is empty', async () => {
    const res = await request(app).get(PATH).set('Authorization', 'Bearer ');
    expect(res.status).toBe(404);
  });

  it('reject a missing or wrong secret', async () => {
    env.CRON_SECRET = SECRET;
    expect((await request(app).get(PATH)).status).toBe(401);
    expect((await request(app).get(PATH).set('Authorization', 'Bearer wrong')).status).toBe(401);
  });

  it('close sessions that stopped sending heartbeats', async () => {
    env.CRON_SECRET = SECRET;
    const { user } = await registerUser(app);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const session = await prisma.codingSession.create({
      data: {
        userId: user.id,
        source: 'EXTENSION',
        status: 'ACTIVE',
        startedAt: hourAgo,
        lastHeartbeatAt: hourAgo,
        durationSeconds: 0,
        activeSeconds: 0,
      },
    });

    const res = await request(app).get(PATH).set('Authorization', `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ closed: 1 });
    const stored = await prisma.codingSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(stored.status).toBe('ENDED');
  });
});
