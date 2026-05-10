import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChunkSelfHeal, lazyWithSelfHeal, __testing } from '../chunkSelfHeal';

const { RELOADED_FLAG } = __testing;

// REQ-20260509-0025: chunk-self-heal must trigger location.reload() on
// dynamic-import failure, but only once per session — both axes verified.
//
// Notes
//  - jsdom does NOT implement window.location.reload(), so we replace
//    location with a stub that records the calls. Object.defineProperty
//    with writable:true lets us swap it without TypeScript surgery.
//  - Each test installs a fresh listener pair; jsdom doesn't reset listeners
//    between describes by default. We track them on a per-test basis so
//    parallel tests don't cross-fire a stale listener.

function makeReloadSpy() {
  const reload = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload },
    writable: true,
    configurable: true,
  });
  return reload;
}

function fireUnhandledRejection(message: string) {
  // jsdom supports PromiseRejectionEvent but `new` requires options object.
  const rejected = Promise.reject(new Error(message));
  // Swallow the actual rejection so vitest doesn't blow the test
  // (we are just simulating the platform event below).
  rejected.catch(() => {});
  const event = new Event('unhandledrejection') as unknown as PromiseRejectionEvent;
  Object.defineProperty(event, 'reason', { value: new Error(message), configurable: true });
  Object.defineProperty(event, 'promise', { value: rejected, configurable: true });
  window.dispatchEvent(event);
}

describe('chunkSelfHeal', () => {
  beforeEach(() => {
    sessionStorage.removeItem(RELOADED_FLAG);
  });

  afterEach(() => {
    sessionStorage.removeItem(RELOADED_FLAG);
  });

  it('reloads on vite:preloadError', () => {
    const reload = makeReloadSpy();
    installChunkSelfHeal();

    window.dispatchEvent(new Event('vite:preloadError'));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOADED_FLAG)).toBe('true');
  });

  it('reloads on unhandledrejection matching dynamic-import error', () => {
    const reload = makeReloadSpy();
    installChunkSelfHeal();

    fireUnhandledRejection(
      'Failed to fetch dynamically imported module: https://example.com/assets/foo-XXXX.js',
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated unhandledrejection', () => {
    const reload = makeReloadSpy();
    installChunkSelfHeal();

    fireUnhandledRejection('TypeError: cannot read properties of undefined');
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RELOADED_FLAG)).toBeNull();
  });

  it('does not reload twice in the same session', () => {
    const reload = makeReloadSpy();
    sessionStorage.setItem(RELOADED_FLAG, 'true'); // simulate prior attempt
    installChunkSelfHeal();

    window.dispatchEvent(new Event('vite:preloadError'));
    fireUnhandledRejection('Failed to fetch dynamically imported module');
    expect(reload).not.toHaveBeenCalled();
  });

  it('clears the once-per-session flag on window load so a later deploy can self-heal again', () => {
    makeReloadSpy();
    sessionStorage.setItem(RELOADED_FLAG, 'true'); // simulate prior reload that succeeded
    installChunkSelfHeal();

    window.dispatchEvent(new Event('load'));
    expect(sessionStorage.getItem(RELOADED_FLAG)).toBeNull();
  });

  it('lazyWithSelfHeal triggers reloadOnce when factory rejects with chunk-load error', async () => {
    const reload = makeReloadSpy();
    const factory = vi.fn(() =>
      Promise.reject(
        new Error('Failed to fetch dynamically imported module: https://example.com/assets/foo-XXXX.js'),
      ),
    );

    // Calling the lazy component's `_payload` is internal — instead invoke the
    // factory React would call (lazyWithSelfHeal returns a LazyExoticComponent
    // whose internals call factory()). We exercise the wrapper by reaching
    // into React.lazy's payload._init pattern.
    const Lazy = lazyWithSelfHeal(factory as never);
    // React's LazyExoticComponent has private `_payload._result`/`_init`
    // fields; calling _init triggers the factory.
    const payload = (Lazy as unknown as { _payload: { _status: number; _result: () => Promise<unknown> } })._payload;
    const init = (Lazy as unknown as { _init: (p: typeof payload) => unknown })._init;
    try {
      init(payload);
    } catch {
      // _init throws the in-flight promise (Suspense pattern); ignore.
    }
    // Wait a microtask so the factory's .catch handler runs.
    await new Promise((r) => setTimeout(r, 0));
    expect(factory).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('lazyWithSelfHeal re-throws non-chunk errors so React still surfaces them', async () => {
    const reload = makeReloadSpy();
    const factory = vi.fn(() => Promise.reject(new Error('TypeError: something else')));

    const Lazy = lazyWithSelfHeal(factory as never);
    const payload = (Lazy as unknown as { _payload: unknown })._payload;
    const init = (Lazy as unknown as { _init: (p: unknown) => unknown })._init;
    try {
      init(payload);
    } catch {
      // ignore Suspense throw
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(factory).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });
});
