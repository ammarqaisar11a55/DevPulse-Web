import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { computeStreak, rollUp } from '../src/modules/analytics/analytics.service';
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

describe('analytics report', () => {
  const range = (from: string, to: string) =>
    `from=${encodeURIComponent(pkt(from).toISOString())}&to=${encodeURIComponent(pkt(to).toISOString())}`;

  it('aggregates totals, distributions and comparisons for a range', async () => {
    const { auth, user } = await karachiUser();
    const project = await prisma.project.create({
      data: { userId: user.id, name: 'Notes', slug: 'notes', color: 'teal' },
    });
    // Mon 28 Sep 09:30–11:00 local: 30 min in the 09:00 hour, 60 min in the 10:00 hour.
    await insertSession({
      userId: user.id,
      projectId: project.id,
      startedAt: pkt('2026-09-28T09:30:00'),
      durationSeconds: 90 * 60,
      language: 'typescript',
    });
    // Tue 29 Sep, a short session.
    await insertSession({
      userId: user.id,
      startedAt: pkt('2026-09-29T20:00:00'),
      durationSeconds: 20 * 60,
      language: 'python',
    });
    // Previous period (21–27 Sep).
    await insertSession({
      userId: user.id,
      startedAt: pkt('2026-09-22T10:00:00'),
      durationSeconds: HOUR,
    });

    const res = await request(app)
      .get(`/api/v1/analytics/report?${range('2026-09-28T00:00:00', '2026-10-05T00:00:00')}`)
      .set(auth);
    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.range).toMatchObject({
      fromDate: '2026-09-28',
      toDate: '2026-10-04',
      days: 7,
      timezone: 'Asia/Karachi',
    });
    expect(data.totals).toMatchObject({
      seconds: 110 * 60,
      sessions: 2,
      activeDays: 2,
      averageSessionSeconds: 55 * 60,
    });
    expect(data.previous).toMatchObject({ seconds: HOUR, sessions: 1, activeDays: 1 });
    expect(data.daily).toHaveLength(7);
    expect(data.weekly).toEqual([{ date: '2026-09-28', seconds: 110 * 60, sessions: 2 }]);
    expect(data.hourly[9].seconds).toBe(30 * 60);
    expect(data.hourly[10].seconds).toBe(60 * 60);
    expect(data.hourly[20].seconds).toBe(20 * 60);
    expect(data.weekdays[1].seconds).toBe(90 * 60); // Monday
    expect(data.sessionLengths.map((bucket: { sessions: number }) => bucket.sessions)).toEqual([
      1, 0, 1,
    ]);
    expect(data.projects[0]).toMatchObject({ id: project.id, seconds: 90 * 60 });
    expect(data.languages.map((item: { label: string }) => item.label)).toEqual([
      'typescript',
      'python',
    ]);
    expect(data.devices).toEqual([
      { id: null, label: 'Logged manually', color: null, seconds: 110 * 60 },
    ]);
  });

  it('applies filters to every aggregate', async () => {
    const { auth, user } = await karachiUser();
    const project = await prisma.project.create({
      data: { userId: user.id, name: 'P', slug: 'p' },
    });
    await insertSession({
      userId: user.id,
      projectId: project.id,
      startedAt: pkt('2026-09-28T09:00:00'),
      durationSeconds: HOUR,
    });
    await insertSession({
      userId: user.id,
      startedAt: pkt('2026-09-28T12:00:00'),
      durationSeconds: HOUR,
    });

    const res = await request(app)
      .get(
        `/api/v1/analytics/report?${range('2026-09-28T00:00:00', '2026-09-29T00:00:00')}&projectId=${project.id}`,
      )
      .set(auth);
    expect(res.body.data.totals.seconds).toBe(HOUR);
    expect(res.body.data.hourly[12].seconds).toBe(0);
  });

  it('defaults to the last 30 days and rejects invalid ranges', async () => {
    const { auth } = await karachiUser();
    const res = await request(app).get('/api/v1/analytics/report').set(auth);
    expect(res.body.data.range).toMatchObject({ days: 30, toDate: '2026-09-30' });

    const reversed = await request(app)
      .get(`/api/v1/analytics/report?${range('2026-09-28T00:00:00', '2026-09-20T00:00:00')}`)
      .set(auth);
    expect(reversed.status).toBe(400);
    const tooLong = await request(app)
      .get(`/api/v1/analytics/report?${range('2024-01-01T00:00:00', '2026-09-20T00:00:00')}`)
      .set(auth);
    expect(tooLong.status).toBe(400);
  });

  it('serves a coding-time series at week granularity', async () => {
    const { auth, user } = await karachiUser();
    await insertSession({
      userId: user.id,
      startedAt: pkt('2026-09-22T10:00:00'),
      durationSeconds: HOUR,
    });
    await insertSession({
      userId: user.id,
      startedAt: pkt('2026-09-29T10:00:00'),
      durationSeconds: 2 * HOUR,
    });
    const res = await request(app)
      .get(
        `/api/v1/analytics/coding-time?${range('2026-09-21T00:00:00', '2026-10-05T00:00:00')}&granularity=week`,
      )
      .set(auth);
    expect(res.body.data.series).toEqual([
      { date: '2026-09-21', seconds: HOUR, sessions: 1 },
      { date: '2026-09-28', seconds: 2 * HOUR, sessions: 1 },
    ]);
    expect(res.body.data.totalSeconds).toBe(3 * HOUR);
  });

  it('rolls days up into months', () => {
    const monthly = rollUp(
      [
        { date: '2026-08-31', seconds: 10, sessions: 1 },
        { date: '2026-09-01', seconds: 20, sessions: 2 },
      ],
      'month',
      1,
    );
    expect(monthly).toEqual([
      { date: '2026-08-01', seconds: 10, sessions: 1 },
      { date: '2026-09-01', seconds: 20, sessions: 2 },
    ]);
  });
});
