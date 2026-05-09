/**
 * REQ-20260509-0025: SPA chunk-load self-heal.
 *
 * Vite 把每个 React.lazy 的 module 编译为独立 hashed chunk
 * (`ProductReviewList-XXXXXX.js`)。每次 prod / demo deploy 后老 chunk 被
 * `rsync --delete` 物理删除，已打开的 tab 仍持有旧 SPA 时，下一次 dynamic
 * import 拉旧 hash → 404 → React 整页崩溃，用户看到 "Page Crashed"。
 *
 * 这里挂两条全局监听捕获该错误，并自动 reload 一次拉新 bundle。
 *
 *  1. `vite:preloadError` —— Vite 4.4+ 在 modulepreload 失败时派发的 CustomEvent。
 *     event.preventDefault() 也能跳过其默认 throw 行为，但我们仍需 reload
 *     才能拿到新的 entry HTML。
 *  2. `unhandledrejection` —— 兜底匹配 "Failed to fetch dynamically imported
 *     module" 文案，覆盖 Vite event 不一定到达的边缘场景（e.g. 浏览器把
 *     fetch 异常挂在 Promise 上而非 preload 链路）。
 *
 * 用 sessionStorage 防 reload 死循环——一次自愈不奏效（chunk 真的坏了或
 * CDN 持续 404）就停手，让 console 留 trace 供排查；下次手动刷新或新 tab
 * 自动清空 session 才会再尝试。
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
    const reason = event.reason;
    const message =
      (reason && typeof reason === 'object' && 'message' in reason && String((reason as Error).message)) ||
      String(reason ?? '');
    if (DYNAMIC_IMPORT_ERR_RE.test(message)) {
      // 拦下默认控制台噪音，让 reloadOnce 决定怎么提示
      event.preventDefault();
      reloadOnce('unhandledrejection matched dynamic-import error', message);
    }
  });
}

// Internal exports for the unit test — not part of the public API.
export const __testing = {
  RELOADED_FLAG,
  DYNAMIC_IMPORT_ERR_RE,
};
