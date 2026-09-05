import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';

const okResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ ok: true, data }), { status, headers: { 'Content-Type': 'application/json' } });

describe('createApiClient', () => {
  it('devuelve null sin URL o sin initData', () => {
    expect(createApiClient({ baseUrl: undefined, initData: 'x' })).toBeNull();
    expect(createApiClient({ baseUrl: 'https://a', initData: '' })).toBeNull();
  });

  it('envía la cabecera tma y desenvuelve la respuesta', async () => {
    const fetchImpl = vi.fn(async () => okResponse({ preferences: null, menu: null, shopping_list: null, pantry: [], favorites: [], updated_at: null }));
    const api = createApiClient({ baseUrl: 'https://x.supabase.co/functions/v1/api/', initData: 'user=1&hash=abc', fetchImpl, clientVersion: 'v1' })!;
    const state = await api.getState();
    expect(state.pantry).toEqual([]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://x.supabase.co/functions/v1/api/me/state');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('tma user=1&hash=abc');
    expect((init.headers as Record<string, string>)['X-Client-Version']).toBe('v1');
  });

  it('serializa el cuerpo en PUT y acepta 204 sin cuerpo', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
      init?.method === 'POST' ? new Response(null, { status: 204 }) : okResponse({ pantry: ['arroz'] }),
    );
    const api = createApiClient({ baseUrl: 'https://x', initData: 'i', fetchImpl })!;
    await api.putState({ pantry: ['arroz'] });
    expect(JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ pantry: ['arroz'] });
    await expect(api.event('menu', 'generate')).resolves.toBeUndefined();
  });

  it('convierte errores del servidor en ApiError con código', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { code: 'expired', message: 'Sesión caducada' } }), { status: 401 }));
    const api = createApiClient({ baseUrl: 'https://x', initData: 'i', fetchImpl })!;
    const err = await api.session().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('expired');
    expect((err as ApiError).isAuth).toBe(true);
  });

  it('respuesta sin JSON válido → ApiError http_error', async () => {
    const fetchImpl = vi.fn(async () => new Response('gateway error', { status: 502 }));
    const api = createApiClient({ baseUrl: 'https://x', initData: 'i', fetchImpl })!;
    await expect(api.getState()).rejects.toMatchObject({ code: 'http_error', status: 502 });
  });
});
