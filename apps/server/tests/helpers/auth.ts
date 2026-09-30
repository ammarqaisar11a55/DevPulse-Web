import request from 'supertest';
import type { Express } from 'express';

export const CLIENT_HEADER = { 'X-DevPulse-Client': 'web' };

let counter = 0;

export function uniqueUser(
  overrides: Partial<Record<'fullName' | 'username' | 'email' | 'password', string>> = {},
) {
  counter += 1;
  const password = overrides.password ?? 'correct-horse-9';
  return {
    fullName: 'Ada Lovelace',
    username: `ada${counter}`,
    email: `ada${counter}@example.com`,
    password,
    confirmPassword: password,
    ...overrides,
  };
}

export function refreshCookieFrom(res: request.Response): string | undefined {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  return cookies?.find((cookie) => cookie.startsWith('dp_refresh='))?.split(';')[0];
}

/** Registers a user and returns its access token, refresh cookie and profile. */
export async function registerUser(app: Express, overrides: Parameters<typeof uniqueUser>[0] = {}) {
  const input = uniqueUser(overrides);
  const res = await request(app).post('/api/v1/auth/register').send(input);
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    input,
    user: res.body.data.user as { id: string; email: string; username: string },
    accessToken: res.body.data.accessToken as string,
    cookie: refreshCookieFrom(res)!,
    auth: { Authorization: `Bearer ${res.body.data.accessToken as string}` },
  };
}
