/**
 * REQ-20260510-0001 F5/F10 · 统一翻译状态机 hook
 *
 * 适配 supplier / admin 两种翻译状态接口，输出统一的 4 态：
 *   - in_progress  翻译中
 *   - failed       翻译失败
 *   - unknown      60s 轮询未 ready，进入降级状态（用户可手动 Refresh）
 *   - ready        全部就绪，停止轮询
 *
 * 缺陷修订（PRD v1.1 附录 A）:
 *   - #7  useEffect cleanup return clearTimeout + AbortController 防 unmount race
 *   - #8  60s（30 次 × 2s）后切 unknown 状态，停止主动轮询
 *   - #10 supplier 单接口 / admin 双接口（EN+ZH）合并取最严重状态
 *   - #4  retryable 仅在 admin 模式可为 true，supplier 模式永远 false
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supplierProductService } from '../services/supplierProductService';

export type UnifiedStatus = 'in_progress' | 'failed' | 'unknown' | 'ready';

export interface UnifiedTranslationStatusResult {
  status: UnifiedStatus;
  /** admin 模式下 failed 时为 true，supplier 模式下永远 false（仅 Back to Edit） */
  retryable: boolean;
  /** 手动重新触发一次轮询（用于 unknown 状态的 Refresh 按钮） */
  refresh: () => void;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30; // 30 × 2s = 60s

/**
 * supplier 模式：单接口 GET /supplier/products/:id/translation-status
 *   后端返回 task.status: 'pending' | 'running' | 'success' | 'failed'
 *   映射: pending|running → in_progress / success → ready / failed → failed
 *   404 (no translation task yet) → in_progress（用户刚保存，task 还没建）
 */
async function fetchSupplierStatus(productId: number, signal: AbortSignal): Promise<UnifiedStatus | 'no_task'> {
  try {
    const resp = await supplierProductService.getTranslationStatus(productId);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!resp) return 'no_task';
    if (resp.status === 'success') return 'ready';
    if (resp.status === 'failed') return 'failed';
    return 'in_progress';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('no translation task') || message.includes('404')) {
      return 'no_task';
    }
    throw err;
  }
}

export function useUnifiedTranslationStatus(
  role: 'supplier' | 'admin',
  productId: number | null,
  options?: { enabled?: boolean },
): UnifiedTranslationStatusResult {
  const enabled = options?.enabled !== false;

  const [status, setStatus] = useState<UnifiedStatus>('in_progress');
  const [tick, setTick] = useState(0); // refresh() 通过 bump 触发 effect 重跑
  const pollCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !productId) return;

    pollCountRef.current = 0;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    let cancelled = false;

    const poll = async () => {
      if (cancelled || signal.aborted) return;

      try {
        let resolved: UnifiedStatus;
        if (role === 'supplier') {
          const r = await fetchSupplierStatus(productId, signal);
          // no_task 等同 in_progress（task 还没建，继续等）
          resolved = r === 'no_task' ? 'in_progress' : r;
        } else {
          // admin 模式 F3 实装。当前先按 in_progress 返回避免编译错误。
          // TODO(F3): 并发取 EN+ZH 状态，合并取最严重（failed > in_progress > unknown > ready）
          resolved = 'in_progress';
        }

        if (cancelled || signal.aborted) return;
        setStatus(resolved);

        // 终态：ready / failed → 停止轮询
        if (resolved === 'ready' || resolved === 'failed') return;

        pollCountRef.current += 1;
        if (pollCountRef.current >= MAX_POLLS) {
          setStatus('unknown');
          return;
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // 网络抖动不立即降级，继续轮询直到上限
      }

      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timerRef.current = setTimeout(poll, 0);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [role, productId, enabled, tick]);

  const refresh = useCallback(() => {
    pollCountRef.current = 0;
    setStatus('in_progress');
    setTick((n) => n + 1);
  }, []);

  return {
    status,
    retryable: role === 'admin' && status === 'failed',
    refresh,
  };
}
