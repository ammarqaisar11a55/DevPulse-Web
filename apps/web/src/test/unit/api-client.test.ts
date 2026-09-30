import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, configureAuthHandlers, tokenStore } from '@/lib/api-client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  tokenStore.set('expired-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  tokenStore.set(null);
});

describe('api client', () => {
  it('sends the access token and client header', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: { ok: true } }));
    await api.get('/things');
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer expired-token',
      'X-DevPulse-Client': 'web',
    });
    expect(init.credentials).toBe('include');
  });

  it('refreshes once for concurrent 401s and retries with the new token', async () => {
    const refresh = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      tokenStore.set('fresh-token');
      return 'fresh-token';
    });
    configureAuthHandlers({ refresh, onUnauthorized: vi.fn() });
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer fresh-token'
        ? json(200, { data: 'ok' })
        : json(401, { error: { code: 'UNAUTHORIZED', message: 'Expired' } });
    });

    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    expect(results).toEqual(['ok', 'ok', 'ok']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('signs out when the refresh fails', async () => {
    const onUnauthorized = vi.fn();
    configureAuthHandlers({ refresh: async () => null, onUnauthorized });
    fetchMock.mockResolvedValue(json(401, { error: { code: 'UNAUTHORIZED', message: 'Expired' } }));
    await expect(api.get('/secret')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('turns server errors into typed errors with field details', async () => {
    fetchMock.mockResolvedValueOnce(
      json(409, {
        error: {
          code: 'CONFLICT',
          message: 'Taken',
          details: [{ path: 'email', message: 'In use' }],
        },
      }),
    );
    const error = await api.post('/users', {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).fieldErrors()).toEqual({ email: 'In use' });
  });

  it('reports network failures in plain language', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.get('/x', { auth: false })).rejects.toMatchObject({
      status: 0,
      message: expect.stringMatching(/connection/i),
    });
  });
});
