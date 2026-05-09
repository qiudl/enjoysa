import React, { useEffect, useRef, useState } from 'react';
import {
  adminService,
  type ZhTranslationStatus,
  type ZhTranslationTaskStatus,
} from '../../../services/adminService';
import styles from './ChinesePreview.module.css';

export interface ChinesePreviewProps {
  /** Product ID whose latest EN→ZH task we poll. */
  productId: number;
  /**
   * When false, the panel renders nothing — used while the admin is on a
   * "create new" page that hasn't persisted a product yet.
   */
  active?: boolean;
  /** Polling interval in ms. Defaults to 2000. */
  pollIntervalMs?: number;
}

/**
 * Read-only Chinese translation preview for an admin-edited product.
 *
 * REQ-20260509-0015: admins can write English first, the AI generates Chinese.
 * Mirror of `EnglishPreview`, just pointed at the EN→ZH endpoints and wired
 * to *_zh fields. Editing the ZH side directly keeps the existing manual
 * fields in the form — this panel only surfaces the latest auto-translation.
 */
export const ChinesePreview: React.FC<ChinesePreviewProps> = ({
  productId,
  active = true,
  pollIntervalMs = 2000,
}) => {
  const [status, setStatus] = useState<ZhTranslationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // Existing products with no EN→ZH task return 404 from /zh-translation-status.
  // Surface that as a quiet "no history" state and stop polling so the
  // console isn't flooded; admin can hit Regenerate to start a fresh task.
  const [noTaskYet, setNoTaskYet] = useState(false);
  const [pollKey, setPollKey] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    cancelledRef.current = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const resp = await adminService.getZhTranslationStatus(productId);
        if (cancelledRef.current) return;
        if (resp) {
          setStatus(resp);
          setError(null);
          setNoTaskYet(false);
          if (isTerminal(resp.status)) return; // stop polling
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('no en2zh translation task')) {
          setNoTaskYet(true);
          return;
        }
        setError(message);
      }
      if (!cancelledRef.current) {
        timer = window.setTimeout(poll, pollIntervalMs);
      }
    };

    timer = window.setTimeout(poll, 0);
    return () => {
      cancelledRef.current = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [productId, active, pollIntervalMs, pollKey]);

  const restartPolling = () => {
    setNoTaskYet(false);
    setError(null);
    setPollKey((k) => k + 1);
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await adminService.retryZhTranslation(productId);
      setStatus((prev) =>
        prev ? { ...prev, status: 'pending', retries: 0, last_error: undefined } : prev,
      );
      restartPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await adminService.regenerateZhTranslation(productId);
      setStatus((prev) =>
        prev
          ? { ...prev, status: 'pending', retries: 0, last_error: undefined }
          : {
              task_id: 0,
              direction: 'en2zh',
              status: 'pending',
              retries: 0,
              updated_at: new Date().toISOString(),
            },
      );
      restartPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(false);
    }
  };

  if (!active) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>中文预览 (auto-translated from English)</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.regenBtn}
            onClick={handleRegenerate}
            disabled={regenerating}
            title="Force a fresh EN→ZH translation against the latest English fields"
          >
            {regenerating ? '↻ ...' : '↻ Regenerate'}
          </button>
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className={styles.body}>
          {noTaskYet ? (
            <div className={`${styles.statusRow} ${styles.statusPending}`}>
              <span>该商品暂无中文自动翻译记录。点击 ↻ Regenerate 从英文重新生成中文。</span>
            </div>
          ) : (
            <>
              <StatusRow status={status} error={error} retrying={retrying} onRetry={handleRetry} />
              {status?.status === 'success' && status.preview && (
                <PreviewBody preview={status.preview} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

function isTerminal(s: ZhTranslationTaskStatus): boolean {
  return s === 'success' || s === 'failed';
}

const StatusRow: React.FC<{
  status: ZhTranslationStatus | null;
  error: string | null;
  retrying: boolean;
  onRetry: () => void;
}> = ({ status, error, retrying, onRetry }) => {
  if (error && !status) {
    return <div className={`${styles.statusRow} ${styles.statusFailed}`}>Error: {error}</div>;
  }
  if (!status) {
    return (
      <div className={`${styles.statusRow} ${styles.statusPending}`}>
        <span className={styles.spinner} />
        <span>Waiting for translation task…</span>
      </div>
    );
  }
  if (status.status === 'pending' || status.status === 'running') {
    return (
      <div className={`${styles.statusRow} ${styles.statusPending}`}>
        <span className={styles.spinner} />
        <span>Translating to 中文 (typically &lt; 8s)…</span>
      </div>
    );
  }
  if (status.status === 'failed') {
    return (
      <div className={`${styles.statusRow} ${styles.statusFailed}`}>
        <span>Translation failed{status.last_error ? `: ${status.last_error}` : ''}</span>
        <button type="button" className={styles.retryBtn} onClick={onRetry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }
  return <div className={`${styles.statusRow} ${styles.statusSuccess}`}>Translated.</div>;
};

const PreviewBody: React.FC<{ preview: NonNullable<ZhTranslationStatus['preview']> }> = ({ preview }) => {
  const fields: Array<{ key: keyof typeof preview; label: string }> = [
    { key: 'name_zh', label: 'Name (中文)' },
    { key: 'summary_zh', label: 'Summary (中文)' },
    { key: 'description_zh', label: 'Description (中文)' },
    { key: 'address_zh', label: 'Address (中文)' },
  ];
  return (
    <>
      {fields.map(({ key, label }) => {
        const value = preview[key];
        return (
          <div key={key} className={styles.field}>
            <div className={styles.fieldLabel}>{label}</div>
            <div className={`${styles.fieldValue} ${value ? '' : styles.empty}`}>
              {value || '(empty)'}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default ChinesePreview;
