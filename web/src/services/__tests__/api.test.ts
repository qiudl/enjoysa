import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  _refreshInFlight,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  request,
  setTokens,
} from '../api';

// REQ-20260506-0005: refresh-token auto retry on 401.

interface FetchCall {
  url: string;
  init: RequestInit;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setupFetchSequence(responses: ((call: FetchCall) => Response)[]) {
  const calls: FetchCall[] = [];
  let i = 0;
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    const handler = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return handler(call);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

// vitest provides an empty `localStorage = {}` in this project (the
// `--localstorage-file` flag is mis-configured upstream), so we install a
// minimal Map-backed Storage shim before each test.
function installLocalStorage() {
  const store = new Map<string, string>();
  const fakeStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    key(i: number) {
      return Array.from(store.keys())[i] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: fakeStorage,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  installLocalStorage();
  _refreshInFlight.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request() with 401 refresh retry', () => {
  it('refreshes and retries the original request when access token expires', async () => {
    setTokens('supplier', 'old-access', 'good-refresh');

    const { calls } = setupFetchSequence([
      // 1. original request -> 401
      () => jsonResponse(401, { success: false, error: 'Unauthorized' }),
      // 2. refresh request -> success
      () =>
        jsonResponse(200, {
          success: true,
          data: {
            token: {
              access_token: 'new-access',
              refresh_token: 'new-refresh',
              expires_in: 3600,
            },
          },
        }),
      // 3. retry of original request -> success
      () => jsonResponse(200, { success: true, data: { ok: true } }),
    ]);

    const result = await request<{ ok: boolean }>('/supplier/products', { method: 'GET' }, 'supplier');

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(3);
    expect(calls[0].url).toContain('/supplier/products');
    expect(calls[1].url).toContain('/supplier/auth/refresh');
    expect(calls[2].url).toContain('/supplier/products');

    // Retried request must use the NEW access token.
    const retryAuth = (calls[2].init.headers as Record<string, string>)?.Authorization;
    expect(retryAuth).toBe('Bearer new-access');

    // Tokens were rotated.
    expect(getAccessToken('supplier')).toBe('new-access');
    expect(getRefreshToken('supplier')).toBe('new-refresh');
  });

  it('shares ONE refresh call for concurrent 401 requests (single-flight)', async () => {
    setTokens('user', 'old-access', 'good-refresh');

    let refreshCalls = 0;
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) {
        refreshCalls += 1;
        // small delay so the second concurrent request also enters tryRefresh
        await new Promise((r) => setTimeout(r, 10));
        return jsonResponse(200, {
          success: true,
          data: {
            token: {
              access_token: 'new-access',
              refresh_token: 'new-refresh',
              expires_in: 3600,
            },
          },
        });
      }
      // Original endpoints: first calls 401, retries with Bearer new-access -> 200
      return jsonResponse(200, { success: true, data: { ok: true } });
    });
    // First two calls (originals) must return 401; later (retries) return 200.
    const seen = new Map<string, number>();
    fetchMock.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 10));
        return jsonResponse(200, {
          success: true,
          data: {
            token: {
              access_token: 'new-access',
              refresh_token: 'new-refresh',
              expires_in: 3600,
            },
          },
        });
      }
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      const count = (seen.get(u) ?? 0) + 1;
      seen.set(u, count);
      if (auth === 'Bearer new-access') {
        return jsonResponse(200, { success: true, data: { ok: true, url: u } });
      }
      return jsonResponse(401, { success: false, error: 'Unauthorized' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([
      request<{ ok: boolean }>('/auth/me', { method: 'GET' }, 'user'),
      request<{ ok: boolean }>('/auth/orders', { method: 'GET' }, 'user'),
    ]);

    expect(a).toEqual({ ok: true, url: expect.stringContaining('/auth/me') });
    expect(b).toEqual({ ok: true, url: expect.stringContaining('/auth/orders') });
    expect(refreshCalls).toBe(1);
  });

  it('falls back to clearTokens + throws when refresh itself fails', async () => {
    setTokens('admin', 'old-access', 'stale-refresh');

    setupFetchSequence([
      () => jsonResponse(401, { success: false, error: 'Unauthorized' }),
      () => jsonResponse(401, { success: false, error: 'invalid refresh' }),
    ]);

    await expect(
      request('/admin/dashboard', { method: 'GET' }, 'admin'),
    ).rejects.toMatchObject({ status: 401 });

    expect(getAccessToken('admin')).toBeNull();
    expect(getRefreshToken('admin')).toBeNull();
  });

  it('does not attempt refresh when there is no refresh token', async () => {
    localStorage.setItem('enjoysa_supplier_token', 'lone-access');
    // no refresh token set

    const { calls } = setupFetchSequence([
      () => jsonResponse(401, { success: false, error: 'Unauthorized' }),
    ]);

    await expect(
      request('/supplier/me', { method: 'GET' }, 'supplier'),
    ).rejects.toBeInstanceOf(ApiError);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/supplier/me');
    expect(getAccessToken('supplier')).toBeNull();
  });

  it('does not retry if the retried request itself returns 401 again', async () => {
    setTokens('user', 'old-access', 'refresh-token');

    let originalCalls = 0;
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) {
        return jsonResponse(200, {
          success: true,
          data: {
            token: {
              access_token: 'new-access',
              refresh_token: 'new-refresh',
              expires_in: 3600,
            },
          },
        });
      }
      originalCalls += 1;
      return jsonResponse(401, { success: false, error: 'Unauthorized' });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      request('/auth/me', { method: 'GET' }, 'user'),
    ).rejects.toMatchObject({ status: 401 });

    // Original endpoint must not loop: hit twice (initial + 1 retry), no more.
    expect(originalCalls).toBe(2);
    expect(getAccessToken('user')).toBeNull();
  });
});

describe('clearTokens noise reduction', () => {
  it('warns without attaching an Error stack trace', () => {
    setTokens('supplier', 'a', 'b');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    clearTokens('supplier');

    expect(warn).toHaveBeenCalledTimes(1);
    const args = warn.mock.calls[0];
    expect(args[0]).toContain('clearTokens(supplier)');
    // No second arg (no Error stack) — keeps the prod console clean.
    expect(args.length).toBe(1);
  });
});
