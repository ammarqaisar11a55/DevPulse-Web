import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { testOutbox } from '../src/utils/mailer';
import { resetDatabase } from './helpers/db';
import { registerUser } from './helpers/auth';

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
  testOutbox.length = 0;
});

describe('profile', () => {
  it('returns the current user with settings', async () => {
    const { auth, user } = await registerUser(app);
    const res = await request(app).get('/api/v1/users/me').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: user.id,
      timezone: 'UTC',
      settings: { theme: 'SYSTEM' },
    });
  });

  it('updates profile fields and validates the time zone', async () => {
    const { auth } = await registerUser(app);
    const ok = await request(app).patch('/api/v1/users/me').set(auth).send({
      fullName: 'Ada King',
      bio: 'Analytical engines',
      timezone: 'Asia/Karachi',
      avatarUrl: '',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      fullName: 'Ada King',
      bio: 'Analytical engines',
      timezone: 'Asia/Karachi',
      avatarUrl: null,
    });

    const bad = await request(app)
      .patch('/api/v1/users/me')
      .set(auth)
      .send({ timezone: 'Mars/Olympus' });
    expect(bad.status).toBe(400);

    const insecureAvatar = await request(app)
      .patch('/api/v1/users/me')
      .set(auth)
      .send({ avatarUrl: 'javascript:alert(1)' });
    expect(insecureAvatar.status).toBe(400);
  });

  it('ignores attempts to set protected fields through the profile endpoint', async () => {
    const { auth, user } = await registerUser(app);
    await request(app)
      .patch('/api/v1/users/me')
      .set(auth)
      .send({ email: 'hijack@example.com', isDemo: true });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.email).toBe(user.email);
    expect(stored.isDemo).toBe(false);
  });
});

describe('identity changes', () => {
  it('requires the current password', async () => {
    const { auth } = await registerUser(app);
    const res = await request(app)
      .patch('/api/v1/users/me/identity')
      .set(auth)
      .send({ username: 'newname', currentPassword: 'wrong-password-1' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('currentPassword');
  });

  it('changes the username immediately and rejects taken values', async () => {
    const other = await registerUser(app);
    const { auth, input } = await registerUser(app);

    const taken = await request(app)
      .patch('/api/v1/users/me/identity')
      .set(auth)
      .send({ username: other.input.username, currentPassword: input.password });
    expect(taken.status).toBe(409);

    const res = await request(app)
      .patch('/api/v1/users/me/identity')
      .set(auth)
      .send({ username: 'Fresh_Name', currentPassword: input.password });
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('fresh_name');
  });
});

/** Token from the most recent confirmation link in the test outbox. */
function lastConfirmationToken() {
  const match = /verify-email\?token=([\w%-]+)/.exec(testOutbox.at(-1)?.text ?? '');
  if (!match?.[1]) throw new Error('No confirmation link was sent');
  return decodeURIComponent(match[1]);
}

async function requestEmailChange(auth: Record<string, string>, password: string, email: string) {
  return request(app)
    .patch('/api/v1/users/me/identity')
    .set(auth)
    .send({ email, currentPassword: password });
}

const confirm = (token: string) =>
  request(app).post('/api/v1/users/email-change/confirm').send({ token });

describe('email change', () => {
  it('keeps the current address until the new one is confirmed', async () => {
    const { auth, input, user } = await registerUser(app);

    const res = await requestEmailChange(auth, input.password, 'New@Example.com');
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
    expect(testOutbox.at(-1)).toMatchObject({
      to: 'new@example.com',
      subject: 'Confirm your new DevPulse email address',
    });

    const pending = await request(app).get('/api/v1/users/me/email-change').set(auth);
    expect(pending.body.data).toMatchObject({ newEmail: 'new@example.com' });

    // Only a hash of the token is stored.
    const stored = await prisma.emailChangeRequest.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).not.toBe(lastConfirmationToken());
  });

  it('switches the address once confirmed, notifies the old one and is single-use', async () => {
    const { auth, input, user } = await registerUser(app);
    await requestEmailChange(auth, input.password, 'new@example.com');
    const token = lastConfirmationToken();

    // Works without being signed in: the token proves control of the new address.
    const res = await confirm(token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ email: 'new@example.com' });
    expect(testOutbox.at(-1)).toMatchObject({
      to: input.email,
      subject: 'Your DevPulse email address was changed',
    });

    const me = await request(app).get('/api/v1/users/me').set(auth);
    expect(me.body.data.email).toBe('new@example.com');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'new@example.com', password: input.password });
    expect(login.status).toBe(200);

    const notification = await prisma.notification.findFirst({
      where: { userId: user.id, type: 'SECURITY' },
    });
    expect(notification?.title).toBe('Your email address was changed');

    expect((await confirm(token)).status).toBe(400);
    const pending = await request(app).get('/api/v1/users/me/email-change').set(auth);
    expect(pending.body.data).toBeNull();
  });

  it('rejects expired, replaced and unknown links', async () => {
    const { auth, input, user } = await registerUser(app);
    await requestEmailChange(auth, input.password, 'first@example.com');
    const replaced = lastConfirmationToken();
    await requestEmailChange(auth, input.password, 'second@example.com');
    const current = lastConfirmationToken();

    expect((await confirm(replaced)).status).toBe(400);
    expect((await confirm('x'.repeat(43))).status).toBe(400);

    await prisma.emailChangeRequest.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await confirm(current)).status).toBe(400);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.email).toBe(user.email);
  });

  it('can be cancelled', async () => {
    const { auth, input } = await registerUser(app);
    await requestEmailChange(auth, input.password, 'new@example.com');
    const token = lastConfirmationToken();

    const res = await request(app).delete('/api/v1/users/me/email-change').set(auth);
    expect(res.status).toBe(204);
    expect((await confirm(token)).status).toBe(400);
  });

  it('refuses an address that another account claimed before confirmation', async () => {
    const { auth, input, user } = await registerUser(app);
    const taken = await requestEmailChange(
      auth,
      input.password,
      (await registerUser(app)).user.email,
    );
    expect(taken.status).toBe(409);

    await requestEmailChange(auth, input.password, 'contested@example.com');
    const token = lastConfirmationToken();
    await registerUser(app, { email: 'contested@example.com' });

    expect((await confirm(token)).status).toBe(409);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.email).toBe(user.email);
  });
});

describe('settings', () => {
  it('persists theme and privacy preferences', async () => {
    const { auth } = await registerUser(app);
    const res = await request(app)
      .patch('/api/v1/users/me/settings')
      .set(auth)
      .send({ theme: 'DARK', trackBranchNames: false, idleTimeoutMinutes: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.settings).toMatchObject({
      theme: 'DARK',
      trackBranchNames: false,
      idleTimeoutMinutes: 10,
    });

    const invalid = await request(app)
      .patch('/api/v1/users/me/settings')
      .set(auth)
      .send({ theme: 'NEON' });
    expect(invalid.status).toBe(400);
  });
});

describe('password change', () => {
  it('keeps the current session but signs out other sessions', async () => {
    const { auth, input } = await registerUser(app);
    const other = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: input.email, password: input.password });
    const otherAuth = { Authorization: `Bearer ${other.body.data.accessToken as string}` };

    const res = await request(app).post('/api/v1/users/me/password').set(auth).send({
      currentPassword: input.password,
      newPassword: 'next-password-5',
      confirmPassword: 'next-password-5',
    });
    expect(res.status).toBe(204);

    expect((await request(app).get('/api/v1/users/me').set(auth)).status).toBe(200);
    expect((await request(app).get('/api/v1/users/me').set(otherAuth)).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ identifier: input.email, password: 'next-password-5' })
      ).status,
    ).toBe(200);
  });

  it('rejects an incorrect current password', async () => {
    const { auth } = await registerUser(app);
    const res = await request(app).post('/api/v1/users/me/password').set(auth).send({
      currentPassword: 'not-my-password-1',
      newPassword: 'next-password-5',
      confirmPassword: 'next-password-5',
    });
    expect(res.status).toBe(400);
  });
});

describe('account deletion', () => {
  it('deletes the account and all of its data after confirmation', async () => {
    const { auth, input, user } = await registerUser(app);
    const unconfirmed = await request(app)
      .delete('/api/v1/users/me')
      .set(auth)
      .send({ password: input.password, confirmation: 'yes' });
    expect(unconfirmed.status).toBe(400);

    const res = await request(app)
      .delete('/api/v1/users/me')
      .set(auth)
      .send({ password: input.password, confirmation: 'DELETE' });
    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.authSession.count({ where: { userId: user.id } })).toBe(0);
  });
});
