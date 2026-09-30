import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { computeStreak } from '../src/modules/analytics/analytics.service';
import { resetDatabase } from './helpers/db';
import { registerUser } from './helpers/auth';
import { insertSession } from './helpers/fixtures';

const app = createApp();
const HOUR = 3600;

// Wednesday 2026-09-30, 15:00 in Asia/Karachi (UTC+5) = 10:00 UTC.
const NOW = new Date('2026-09-30T10:00:00Z');
/** A Karachi wall-clock time as a UTC Date. */
const pkt = (isoLocal: string) => new Date(new Date(`${isoLocal}Z`).getTime() - 5 * HOUR * 1000);

beforeEach(async () => {
  await resetDatabase();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

async function karachiUser() {
  const registered = await registerUser(app);
  await prisma.user.update({
    where: { id: registered.user.id },
    data: { timezone: 'Asia/Karachi' },
  });
  return registered;
}

describe('overview aggregation', () => {
  it('splits sessions across local midnight and builds the 7-day series', async () => {
    const { auth, user } = await karachiUser();
    // 23:00 Tue → 01:00 Wed local: one hour counts for each day.
    await insertSession({
      userId: user.id,
      startedAt: pkt('2026-09-29T23:00:00'),
      durationSeconds: 2 * HOUR,
    });
    // Earlier today.
    await insertSession({
      userId: user.id,
      startedAt: pkt('2026-09-30T09:00:00'),
      durationSeconds: HOUR,
      activeSeconds: 1800,
    });

    const res = await request(app).get('/api/v1/analytics/overview').set(auth);
    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.timezone).toBe('Asia/Karachi');
    expect(data.today.seconds).toBe(HOUR + 1800);
    expect(data.last7Days).toHaveLength(7);
    expect(data.last7Days.at(-1)).toEqual({
      date: '2026-09-30',
      seconds: HOUR + 1800,
      sessions: 1,
    });
    expect(data.last7Days.at(-2)).toEqual({ date: '2026-09-29', seconds: HOUR, sessions: 1 });
    expect(data.todayBlocks).toHaveLength(2);
    expect(data.todayBlocks[1].activeRatio).toBe(0.5);
  });

  it('compares the week so far with the same span of last week', async () => {
    const { auth, user } = await karachiUser();
    // This week (starts Mon 28 Sep local).
    await insertSession({
      userId: user.id,
      startedAt: pkt('2026-09-28T10:00:00'),
      durationSeconds: 2 * HOUR,
    });
    // Last week, within the same elapsed span (Mon 21 Sep).
    await insertSession({
      userId: user.id,
      startedAt: pkt('2026-09-21T10:00:00'),
      durationSeconds: HOUR,
    });
    // Last week, after the comparable point (Fri 25 Sep) — excluded from previousSeconds.
    await insertSession({
      userId: user.id,
      startedAt: pkt('2026-09-25T10:00:00'),
      durationSeconds: 5 * HOUR,
    });

    const { body } = await request(app).get('/api/v1/analytics/overview').set(auth);
    expect(body.data.week).toEqual({ seconds: 2 * HOUR, previousSeconds: HOUR });
    expect(body.data.sessions).toEqual({ count: 1, previousCount: 1 });
  });

  it('breaks the week down by project and language', async () => {
    const { auth, user } = await karachiUser();
    const project = await prisma.project.create({
      data: { userId: user.id, name: 'Notes', slug: 'notes', color: 'teal' },
    });
    await insertSession({
      userId: user.id,
      projectId: project.id,
      startedAt: pkt('2026-09-29T10:00:00'),
      durationSeconds: 2 * HOUR,
      language: 'typescript',
    });
    await insertSession({
      userId: user.id,
      startedAt: pkt('2026-09-29T14:00:00'),
      durationSeconds: HOUR,
      language: 'python',
    });

    const { body } = await request(app).get('/api/v1/analytics/overview').set(auth);
    expect(body.data.topProjects).toEqual([
      { id: project.id, label: 'Notes', color: 'teal', seconds: 2 * HOUR },
      { id: null, label: 'No project', color: null, seconds: HOUR },
    ]);
    expect(body.data.topLanguages.map((item: { label: string }) => item.label)).toEqual([
      'typescript',
      'python',
    ]);
    expect(body.data.projects).toEqual({ active: 1, total: 1 });
  });

  it('only includes the requesting users data', async () => {
    const { user: other } = await karachiUser();
    const { auth } = await karachiUser();
    await insertSession({
      userId: other.id,
      startedAt: pkt('2026-09-30T09:00:00'),
      durationSeconds: HOUR,
    });

    const { body } = await request(app).get('/api/v1/analytics/overview').set(auth);
    expect(body.data.today.seconds).toBe(0);
    expect(body.data.hasAnyActivity).toBe(false);
    expect(body.data.recentSessions).toHaveLength(0);
  });
});

describe('streaks', () => {
  it('counts consecutive days ending today or yesterday', () => {
    expect(computeStreak([], '2026-09-30')).toBe(0);
    expect(
      computeStreak(['2026-09-30', '2026-09-29', '2026-09-28', '2026-09-26'], '2026-09-30'),
    ).toBe(3);
    expect(computeStreak(['2026-09-29', '2026-09-28'], '2026-09-30')).toBe(2);
    expect(computeStreak(['2026-09-27'], '2026-09-30')).toBe(0);
  });
});
