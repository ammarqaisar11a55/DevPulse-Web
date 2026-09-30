import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { testOutbox } from '../src/utils/mailer';
import { resetDatabase } from './helpers/db';
import { CLIENT_HEADER, refreshCookieFrom, registerUser, uniqueUser } from './helpers/auth';

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
  testOutbox.length = 0;
});

describe('registration', () => {
  it('creates an account, normalises identifiers and starts a session', async () => {
    const input = uniqueUser({ email: 'Grace@Example.COM', username: 'GraceH' });
    const res = await request(app).post('/api/v1/auth/register').send(input);

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      email: 'grace@example.com',
      username: 'graceh',
      fullName: 'Ada Lovelace',
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.accessToken).toBeTypeOf('string');

    const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: 'grace@example.com' },
      include: { settings: true },
    });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.settings).not.toBeNull();
  });

  it('rejects duplicate email and username with field-level conflicts', async () => {
    await registerUser(app, { email: 'dup@example.com', username: 'dupe' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(uniqueUser({ email: 'DUP@example.com', username: 'Dupe' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.details.map((detail: { path: string }) => detail.path).sort()).toEqual([
      'email',
      'username',
    ]);
  });

  it('validates input', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: '',
      username: 'a',
      email: 'nope',
      password: 'short',
      confirmPassword: 'different',
    });

    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((detail: { path: string }) => detail.path);
    expect(paths).toEqual(expect.arrayContaining(['fullName', 'username', 'email', 'password']));
  });

  it('rejects reserved usernames', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(uniqueUser({ username: 'admin' }));
    expect(res.status).toBe(400);
  });
});

describe('login', () => {
  it('accepts email or username', async () => {
    const { input } = await registerUser(app);
    for (const identifier of [input.email.toUpperCase(), input.username]) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier, password: input.password });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTypeOf('string');
      expect(refreshCookieFrom(res)).toBeDefined();
    }
  });

  it('returns the same error for unknown users and wrong passwords', async () => {
    const { input } = await registerUser(app);
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: input.email, password: 'nope-nope-1' });
    const unknownUser = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'ghost@example.com', password: 'nope-nope-1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
  });
});

describe('authorization', () => {
  it('rejects protected routes without a valid token', async () => {
    const missing = await request(app).get('/api/v1/auth/sessions');
    const forged = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(missing.status).toBe(401);
    expect(forged.status).toBe(401);
    expect(missing.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows access with a valid token', async () => {
    const { auth } = await registerUser(app);
    const res = await request(app).get('/api/v1/auth/sessions').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].current).toBe(true);
  });
});

describe('refresh tokens', () => {
  it('requires the client header (CSRF defence)', async () => {
    const { cookie } = await registerUser(app);
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('rejects untrusted origins', async () => {
    const { cookie } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set({ ...CLIENT_HEADER, Origin: 'https://evil.example', Cookie: cookie });
    expect(res.status).toBe(403);
  });

  it('rotates the refresh token and issues a new access token', async () => {
    const { cookie } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set({ ...CLIENT_HEADER, Cookie: cookie });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    const rotated = refreshCookieFrom(res);
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(cookie);
  });

  it('revokes the session when a rotated token is replayed after the grace window', async () => {
    const { cookie, user } = await registerUser(app);
    const first = await request(app)
      .post('/api/v1/auth/refresh')
      .set({ ...CLIENT_HEADER, Cookie: cookie });
    const rotated = refreshCookieFrom(first)!;

    // Simulate the grace window having passed.
    await prisma.authSession.updateMany({
      where: { userId: user.id },
      data: { rotatedAt: new Date(Date.now() - 60_000) },
    });

    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set({ ...CLIENT_HEADER, Cookie: cookie });
    expect(replay.status).toBe(401);

    // The legitimate (rotated) token no longer works either: the session was revoked.
    const afterRevoke = await request(app)
      .post('/api/v1/auth/refresh')
      .set({ ...CLIENT_HEADER, Cookie: rotated });
    expect(afterRevoke.status).toBe(401);
  });

  it('tolerates a concurrent refresh with the previous token inside the grace window', async () => {
    const { cookie } = await registerUser(app);
    await request(app)
      .post('/api/v1/auth/refresh')
      .set({ ...CLIENT_HEADER, Cookie: cookie });
    const second = await request(app)
      .post('/api/v1/auth/refresh')
      .set({ ...CLIENT_HEADER, Cookie: cookie });
    expect(second.status).toBe(200);
  });
});

describe('logout', () => {
  it('ends the current session and invalidates its access token', async () => {
    const { cookie, auth } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set({ ...CLIENT_HEADER, Cookie: cookie });
    expect(res.status).toBe(204);

    expect((await request(app).get('/api/v1/auth/sessions').set(auth)).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/refresh')
          .set({ ...CLIENT_HEADER, Cookie: cookie })
      ).status,
    ).toBe(401);
  });

  it('logs out every device', async () => {
    const { input, auth } = await registerUser(app);
    const other = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: input.email, password: input.password });
    const otherAuth = { Authorization: `Bearer ${other.body.data.accessToken as string}` };

    expect((await request(app).post('/api/v1/auth/logout-all').set(auth)).status).toBe(204);
    expect((await request(app).get('/api/v1/auth/sessions').set(otherAuth)).status).toBe(401);
  });

  it('revokes a single other session', async () => {
    const { input, auth } = await registerUser(app);
    const other = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: input.email, password: input.password });
    const sessions = await request(app).get('/api/v1/auth/sessions').set(auth);
    const otherSession = sessions.body.data.find(
      (session: { current: boolean }) => !session.current,
    );

    expect(
      (await request(app).delete(`/api/v1/auth/sessions/${otherSession.id}`).set(auth)).status,
    ).toBe(204);
    const otherAuth = { Authorization: `Bearer ${other.body.data.accessToken as string}` };
    expect((await request(app).get('/api/v1/auth/sessions').set(otherAuth)).status).toBe(401);
  });
});

describe('password reset', () => {
  const tokenFromOutbox = () => {
    const match = testOutbox.at(-1)?.text.match(/token=([^\s]+)/);
    return decodeURIComponent(match![1]!);
  };

  it('responds identically for unknown emails and sends nothing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(202);
    expect(testOutbox).toHaveLength(0);
  });

  it('resets the password with a single-use token and signs out every session', async () => {
    const { input, auth } = await registerUser(app);
    await request(app).post('/api/v1/auth/forgot-password').send({ email: input.email });
    expect(testOutbox).toHaveLength(1);
    const token = tokenFromOutbox();

    const stored = await prisma.passwordResetToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token);

    const newPassword = 'brand-new-pass-7';
    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: newPassword, confirmPassword: newPassword });
    expect(reset.status).toBe(204);

    expect((await request(app).get('/api/v1/auth/sessions').set(auth)).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ identifier: input.email, password: input.password })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ identifier: input.email, password: newPassword })
      ).status,
    ).toBe(200);

    const reuse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'another-pass-8', confirmPassword: 'another-pass-8' });
    expect(reuse.status).toBe(400);
  });

  it('rejects expired tokens', async () => {
    const { input } = await registerUser(app);
    await request(app).post('/api/v1/auth/forgot-password').send({ email: input.email });
    const token = tokenFromOutbox();
    await prisma.passwordResetToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'brand-new-pass-7', confirmPassword: 'brand-new-pass-7' });
    expect(res.status).toBe(400);
  });
});
