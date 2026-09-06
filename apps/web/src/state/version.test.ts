import { describe, expect, it, vi } from 'vitest';
import { fetchPublishedVersion, isOutdated } from './version';

describe('versión publicada', () => {
  it('lee version.json sin caché', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ version: 'abc1234' })));
    expect(await fetchPublishedVersion('/nutri-plan/', fetchImpl)).toBe('abc1234');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^\/nutri-plan\/version\.json\?t=\d+$/);
    expect(init.cache).toBe('no-store');
  });
  it('devuelve null si falla o el formato es raro', async () => {
    expect(await fetchPublishedVersion('/', async () => new Response('x', { status: 500 }))).toBeNull();
    expect(await fetchPublishedVersion('/', async () => new Response('{}'))).toBeNull();
    expect(await fetchPublishedVersion('/', async () => { throw new Error('red'); })).toBeNull();
  });
  it('isOutdated ignora dev y nulos', () => {
    expect(isOutdated('a', 'b')).toBe(true);
    expect(isOutdated('a', 'a')).toBe(false);
    expect(isOutdated('dev', 'b')).toBe(false);
    expect(isOutdated('a', null)).toBe(false);
  });
});
