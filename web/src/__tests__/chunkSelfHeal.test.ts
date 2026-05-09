import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChunkSelfHeal, __testing } from '../chunkSelfHeal';

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
});
