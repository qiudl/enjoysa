import { lazy as reactLazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * REQ-20260509-0025 + follow-up: SPA chunk-load self-heal.
 *
 * Vite 把每个 React.lazy 的 module 编译为独立 hashed chunk
 * (`ProductReviewList-XXXXXX.js`)。每次 prod / demo deploy 后老 chunk 被
 * `rsync --delete` 物理删除，已打开的 tab 仍持有旧 SPA 时，下一次 dynamic
 * import 拉旧 hash → 404 → React 整页崩溃，用户看到 "Page Crashed"。
 *
 * 三条防线:
 *
 *  1. `vite:preloadError` —— Vite 4.4+ 在 modulepreload 失败时派发的 CustomEvent。
 *     event.preventDefault() 也能跳过其默认 throw 行为，但我们仍需 reload
 *     才能拿到新的 entry HTML。
 *  2. `unhandledrejection` —— 兜底匹配 "Failed to fetch dynamically imported
 *     module" 文案，覆盖 Vite event 不一定到达的边缘场景（e.g. 浏览器把
 *     fetch 异常挂在 Promise 上而非 preload 链路）。
 *  3. `lazyWithSelfHeal(factory)` —— React 的 lazy() factory 会把 rejection
 *     吞进 ErrorBoundary，**永远不会触发 unhandledrejection**。所以 App.tsx
 *     的每个 lazy 路由都得用这个 wrapper：在 factory rejection 处主动调
 *     reloadOnce(），把 React 截留的错误从静默死亡变成自愈。
 *
 * 用 sessionStorage 防 reload 死循环——但在 `window.load` 上清掉 flag，
 * 这样同一 session 多次 deploy 之间仍然能自愈；只有当 reload 本身没起来
 * (load 没触发) 时 flag 才保留，阻断真无限刷新。
 */

const RELOADED_FLAG = 'enjoysa_chunk_reload_attempted';
const DYNAMIC_IMPORT_ERR_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

function alreadyAttempted(): boolean {
  try {
    return sessionStorage.getItem(RELOADED_FLAG) === 'true';
  } catch {
    // sessionStorage 被 disable（隐私模式、quota）— 不阻止首次 reload
    return false;
  }
}

function markAttempted(): void {
  try {
    sessionStorage.setItem(RELOADED_FLAG, 'true');
  } catch {
    // 写不进就算了，下次还会再尝试一次 reload，不致命
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err ?? '');
}

function reloadOnce(reason: string, detail?: unknown): void {
  if (alreadyAttempted()) {
    // eslint-disable-next-line no-console
    console.warn(
      `[chunk-self-heal] ${reason} — already reloaded once this session, ` +
        `not reloading again. Please refresh manually if the page is broken.`,
      detail,
    );
    return;
  }
  markAttempted();
  // eslint-disable-next-line no-console
  console.warn(`[chunk-self-heal] ${reason} — reloading once to pick up new bundle`, detail);
  window.location.reload();
}

/**
 * Install the self-heal listeners. Idempotent — safe to call from main.tsx
 * once on app boot.
 */
export function installChunkSelfHeal(): void {
  // Vite's typed event — but we don't import vite types here, so cast is fine.
  window.addEventListener('vite:preloadError', (event) => {
    reloadOnce('vite:preloadError fired', event);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = errorMessage(event.reason);
    if (DYNAMIC_IMPORT_ERR_RE.test(message)) {
      // 拦下默认控制台噪音，让 reloadOnce 决定怎么提示
      event.preventDefault();
      reloadOnce('unhandledrejection matched dynamic-import error', message);
    }
  });

  // 一次 reload 跑通后清掉 flag，下次同 session 又部署仍能自愈。
  // 真无限刷新场景下 load 永远不触发，flag 自然保住。
  window.addEventListener('load', () => {
    try {
      sessionStorage.removeItem(RELOADED_FLAG);
    } catch {
      // 同 markAttempted — 写不进就算了
    }
  });
}

/**
 * Drop-in replacement for React.lazy that catches chunk-load rejections and
 * triggers reloadOnce, instead of letting React's ErrorBoundary swallow them.
 *
 * React captures the factory's rejected promise internally; the rejection
 * never reaches `window.onunhandledrejection`. Catching at the factory layer
 * is the only path that wakes the self-heal for these failures.
 *
 * Usage in App.tsx:
 *   const ProductDetailPage = lazyWithSelfHeal(() => import('./pages/...'));
 */
export function lazyWithSelfHeal<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return reactLazy<T>(() =>
    factory().catch((err: unknown) => {
      const message = errorMessage(err);
      if (DYNAMIC_IMPORT_ERR_RE.test(message)) {
        reloadOnce('lazyWithSelfHeal caught dynamic-import error', message);
        // Return a never-resolving promise so React stays in Suspense
        // until the reload kicks in — avoids flashing the ErrorBoundary UI.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }),
  );
}

// Internal exports for the unit test — not part of the public API.
export const __testing = {
  RELOADED_FLAG,
  DYNAMIC_IMPORT_ERR_RE,
};
