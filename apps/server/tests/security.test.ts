import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { analyticsService } from '../src/modules/analytics/analytics.service';
import { resetDatabase } from './helpers/db';
import { registerUser } from './helpers/auth';

const app = createApp();

beforeEach(resetDatabase);
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ENABLE_RATE_LIMIT_IN_TESTS;
});

describe('error handling', () => {
  it('masks unexpected errors without leaking details', async () => {
    const { auth } = await registerUser(app);
    vi.spyOn(analyticsService, 'overview').mockRejectedValueOnce(
      new Error('connect ECONNREFUSED password=hunter2'),
    );
    const res = await request(app).get('/api/v1/analytics/overview').set(auth);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: expect.not.stringMatching(/hunter2|ECONNREFUSED/),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/stack|hunter2|at \//);
  });

  it('rejects oversized request bodies', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ identifier: 'x'.repeat(600 * 1024), password: 'y' }));
    expect(res.status).toBe(413);
  });
});

describe('transport security', () => {
  it('sets security headers', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('only allows the configured frontend origin for CORS', async () => {
    const allowed = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('abuse protection', () => {
  it('rate limits failed sign-in attempts', async () => {
    const { input } = await registerUser(app);
    process.env.ENABLE_RATE_LIMIT_IN_TESTS = 'true';
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      statuses.push(
        (
          await request(app)
            .post('/api/v1/auth/login')
            .send({ identifier: input.email, password: 'wrong-guess-1' })
        ).status,
      );
    }
    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('treats injection-looking input as data', async () => {
    const { auth } = await registerUser(app);
    const payload = encodeURIComponent("x' OR 1=1; DROP TABLE users; --");
    expect((await request(app).get(`/api/v1/search?q=${payload}`).set(auth)).status).toBe(200);
    expect((await request(app).get(`/api/v1/projects?search=${payload}`).set(auth)).status).toBe(
      200,
    );
    expect(await prisma.user.count()).toBe(1);
  });

  it('never returns password hashes or credential hashes', async () => {
    const { auth } = await registerUser(app);
    const bodies = await Promise.all(
      ['/api/v1/users/me', '/api/v1/devices', '/api/v1/auth/sessions'].map((path) =>
        request(app).get(path).set(auth),
      ),
    );
    for (const res of bodies)
      expect(JSON.stringify(res.body)).not.toMatch(
        /argon2|passwordHash|credentialHash|refreshTokenHash/,
      );
  });
});
