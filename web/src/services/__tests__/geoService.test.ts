import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGeo } from '../geoService';

// REQ-20260506-0006: geo lookup must degrade silently. The frontend should
// never gate UX on the success of this call — any failure → zero GeoInfo →
// "show Google login" (the safe default for the majority of users).

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchGeo', () => {
  it('returns parsed geo on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              country: 'CN',
              region: '江苏省',
              is_blocked_region: true,
              google_disabled: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const got = await fetchGeo();
    expect(got).toEqual({
      country: 'CN',
      region: '江苏省',
      is_blocked_region: true,
      google_disabled: true,
    });
  });

  it('returns zero GeoInfo on non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('error', { status: 500 })),
    );

    const got = await fetchGeo();
    expect(got.google_disabled).toBe(false);
    expect(got.country).toBe('');
  });

  it('returns zero GeoInfo when payload has success:false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ success: false, error: 'oops' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const got = await fetchGeo();
    expect(got.google_disabled).toBe(false);
  });

  it('returns zero GeoInfo on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const got = await fetchGeo();
    expect(got.google_disabled).toBe(false);
  });

  it('aborts and returns zero GeoInfo when the request exceeds timeoutMs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        return await new Promise<Response>((resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }
          // never resolves — only rejection via abort
        });
      }),
    );

    const got = await fetchGeo(50);
    expect(got.google_disabled).toBe(false);
  });
});
