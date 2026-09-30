import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { leaderboardWindow } from '../src/modules/leaderboard/leaderboard.service';
import { resetDatabase } from './helpers/db';
import { registerUser } from './helpers/auth';
import { insertSession } from './helpers/fixtures';

const app = createApp();
const HOUR = 3600;
const NOW = new Date('2026-09-30T15:00:00Z'); // Wednesday

beforeEach(async () => {
  await resetDatabase();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

async function participant(hours: number, optIn = true) {
  const registered = await registerUser(app);
  if (optIn)
    await request(app)
      .patch('/api/v1/users/me/settings')
      .set(registered.auth)
      .send({ showOnLeaderboard: true });
  if (hours > 0) {
    await insertSession({
      userId: registered.user.id,
      startedAt: new Date('2026-09-30T08:00:00Z'),
      durationSeconds: hours * HOUR,
    });
  }
  return registered;
}

describe('leaderboard windows', () => {
  it('uses the current UTC day, ISO week and month', () => {
    expect(leaderboardWindow('day', NOW).from.toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(leaderboardWindow('week', NOW).from.toISOString()).toBe('2026-09-28T00:00:00.000Z');
    expect(leaderboardWindow('month', NOW).from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(leaderboardWindow('week', new Date('2026-10-04T23:00:00Z')).from.toISOString()).toBe(
      '2026-09-28T00:00:00.000Z',
    );
  });
});

describe('leaderboard', () => {
  it('ranks only opted-in users and exposes no activity details', async () => {
    const top = await participant(5);
    const second = await participant(3);
    await participant(8, false); // Most time, but not opted in.
    const project = await prisma.project.create({
      data: { userId: top.user.id, name: 'Secret project', slug: 'secret' },
    });
    await prisma.codingSession.updateMany({
      where: { userId: top.user.id },
      data: { projectId: project.id },
    });

    const res = await request(app).get('/api/v1/leaderboard?period=day').set(second.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.participants).toBe(2);
    expect(res.body.data.entries.map((entry: { username: string }) => entry.username)).toEqual([
      top.user.username,
      second.user.username,
    ]);
    expect(res.body.data.entries[0]).toEqual({
      rank: 1,
      username: top.user.username,
      fullName: 'Ada Lovelace',
      avatarUrl: null,
      seconds: 5 * HOUR,
      isCurrentUser: false,
    });
    expect(JSON.stringify(res.body)).not.toContain('Secret project');
    expect(JSON.stringify(res.body)).not.toContain(top.user.email);
    expect(res.body.data.me).toEqual({ optedIn: true, rank: 2, seconds: 3 * HOUR });
  });

  it('shows the callers own time and rank when outside the top entries', async () => {
    await participant(6);
    await participant(5);
    const me = await participant(1);
    const res = await request(app).get('/api/v1/leaderboard?period=week&limit=2').set(me.auth);
    expect(res.body.data.entries).toHaveLength(2);
    expect(res.body.data.me).toEqual({ optedIn: true, rank: 3, seconds: HOUR });
  });

  it('reports time without a rank for users who have not opted in', async () => {
    await participant(2);
    const me = await participant(4, false);
    const res = await request(app).get('/api/v1/leaderboard').set(me.auth);
    expect(res.body.data.period).toBe('week');
    expect(res.body.data.entries).toHaveLength(1);
    expect(res.body.data.me).toEqual({ optedIn: false, rank: null, seconds: 4 * HOUR });
  });

  it('only counts time inside the period', async () => {
    const me = await participant(0);
    await insertSession({
      userId: me.user.id,
      startedAt: new Date('2026-09-29T23:00:00Z'),
      durationSeconds: 2 * HOUR,
    });
    const day = await request(app).get('/api/v1/leaderboard?period=day').set(me.auth);
    const week = await request(app).get('/api/v1/leaderboard?period=week').set(me.auth);
    expect(day.body.data.me.seconds).toBe(HOUR);
    expect(week.body.data.me.seconds).toBe(2 * HOUR);
  });

  it('requires authentication and validates the period', async () => {
    expect((await request(app).get('/api/v1/leaderboard')).status).toBe(401);
    const { auth } = await participant(0);
    expect((await request(app).get('/api/v1/leaderboard?period=year').set(auth)).status).toBe(400);
  });
});
