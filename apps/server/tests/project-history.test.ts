import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { registerUser } from './helpers/auth';
import { resetDatabase } from './helpers/db';
import { insertSession } from './helpers/fixtures';

const app = createApp();
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(resetDatabase);

/** Midnight UTC, `days` days before today. */
function utcDaysAgo(days: number) {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - days * DAY_MS,
  );
}
const dateKey = (date: Date) => date.toISOString().slice(0, 10);

async function setup(accountAgeDays: number) {
  const owner = await registerUser(app);
  // Older than the 366-day analytics cap, to prove the history is not limited by it.
  await prisma.user.update({
    where: { id: owner.user.id },
    data: {
      timezone: 'UTC',
      createdAt: new Date(utcDaysAgo(accountAgeDays).getTime() + 3_600_000),
    },
  });
  const project = await prisma.project.create({
    data: { userId: owner.user.id, name: 'Notes Saver', slug: 'notes-saver' },
  });
  const other = await prisma.project.create({
    data: { userId: owner.user.id, name: 'PortPilot', slug: 'portpilot' },
  });
  return { owner, project, other };
}

describe('project history', () => {
  it('covers every day since the account was created, beyond the analytics range cap', async () => {
    const { owner, project, other } = await setup(400);
    // 1h, 380 days ago at 09:00.
    await insertSession({
      userId: owner.user.id,
      projectId: project.id,
      startedAt: new Date(utcDaysAgo(380).getTime() + 9 * 3_600_000),
      durationSeconds: 3600,
    });
    // 2h spanning midnight 10 days ago: 23:00 to 01:00.
    await insertSession({
      userId: owner.user.id,
      projectId: project.id,
      startedAt: new Date(utcDaysAgo(10).getTime() - 3_600_000),
      durationSeconds: 7200,
    });
    // Another project's time is excluded.
    await insertSession({
      userId: owner.user.id,
      projectId: other.id,
      startedAt: utcDaysAgo(5),
      durationSeconds: 5400,
    });

    const res = await request(app).get(`/api/v1/projects/${project.id}/history`).set(owner.auth);
    expect(res.status).toBe(200);
    const history = res.body.data;

    expect(history.sinceDate).toBe(dateKey(utcDaysAgo(400)));
    expect(history.toDate).toBe(dateKey(utcDaysAgo(0)));
    expect(history.days).toBe(401);
    expect(history.totals).toMatchObject({
      seconds: 3 * 3600,
      sessions: 2,
      activeDays: 3,
      averageSessionSeconds: 5400,
      longestDay: { date: dateKey(utcDaysAgo(380)), seconds: 3600 },
    });

    // Every month from account creation to now is present, including empty ones.
    const months = history.monthly as { date: string; seconds: number }[];
    expect(months[0]?.date).toBe(`${dateKey(utcDaysAgo(400)).slice(0, 7)}-01`);
    expect(months.at(-1)?.date).toBe(`${dateKey(utcDaysAgo(0)).slice(0, 7)}-01`);
    expect(months.length).toBeGreaterThanOrEqual(13);
    expect(months.some((month) => month.seconds === 0)).toBe(true);
    expect(months.reduce((sum, month) => sum + month.seconds, 0)).toBe(3 * 3600);

    // The session across midnight is split between its two days.
    const daily = history.daily as { date: string; seconds: number }[];
    expect(daily).toHaveLength(90);
    expect(daily.find((day) => day.date === dateKey(utcDaysAgo(11)))?.seconds).toBe(3600);
    expect(daily.find((day) => day.date === dateKey(utcDaysAgo(10)))?.seconds).toBe(3600);

    const hourly = history.hourly as { hour: number; seconds: number }[];
    expect(hourly).toHaveLength(24);
    expect(hourly[9]?.seconds).toBe(3600);
    expect(hourly[23]?.seconds).toBe(3600);
    expect(hourly[0]?.seconds).toBe(3600);
  });

  it('starts at the first session when it predates the account', async () => {
    const { owner, project } = await setup(20);
    await insertSession({
      userId: owner.user.id,
      projectId: project.id,
      startedAt: new Date(utcDaysAgo(45).getTime() + 10 * 3_600_000),
      durationSeconds: 1200,
    });
    const res = await request(app).get(`/api/v1/projects/${project.id}/history`).set(owner.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.sinceDate).toBe(dateKey(utcDaysAgo(45)));
    expect(res.body.data.daily).toHaveLength(46);
    expect(res.body.data.sessionLengths[0]).toMatchObject({ key: 'short', sessions: 1 });
  });

  it('returns an empty, zero-filled history for a project without sessions', async () => {
    const { owner, project } = await setup(3);
    const res = await request(app).get(`/api/v1/projects/${project.id}/history`).set(owner.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      days: 4,
      firstActivityAt: null,
      totals: { seconds: 0, sessions: 0, activeDays: 0, longestDay: null },
    });
    expect(res.body.data.daily).toHaveLength(4);
  });

  it("hides other users' projects", async () => {
    const { project } = await setup(10);
    const stranger = await registerUser(app);
    const res = await request(app).get(`/api/v1/projects/${project.id}/history`).set(stranger.auth);
    expect(res.status).toBe(404);
  });
});
