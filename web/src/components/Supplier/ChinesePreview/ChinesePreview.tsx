import React, { useEffect, useRef, useState } from 'react';
import {
  supplierProductService,
  type TranslationStatus,
  type TranslationTaskStatus,
} from '../../../services/supplierProductService';
import styles from './ChinesePreview.module.css';

export interface ChinesePreviewProps {
  /** Product ID whose latest translation task we poll. */
  productId: number;
  /**
   * When false, the panel renders nothing — used when the product has not yet
   * been submitted for review (no task exists yet).
   */
  active?: boolean;
  /** Polling interval in ms. Defaults to 2000. */
  pollIntervalMs?: number;
}

/**
 * Read-only Chinese translation preview for a supplier-submitted product.
 *
 * REQ-20260508-0002 Phase 1: suppliers see what their English copy will look
 * like in Chinese (rendered to C-side users) without being able to edit it.
 * Editing is gated to admin / Phase 2.
 */
export const ChinesePreview: React.FC<ChinesePreviewProps> = ({
  productId,
  active = true,
  pollIntervalMs = 2000,
}) => {
  const [status, setStatus] = useState<TranslationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    cancelledRef.current = false;

    const poll = async () => {
      try {
        const resp = await supplierProductService.getTranslationStatus(productId);
        if (cancelledRef.current) return;
        if (resp) {
          setStatus(resp);
          setError(null);
          if (isTerminal(resp.status)) return; // stop polling
        }
      } catch (err) {
        // 404 = no task yet (e.g. fresh draft); treat as a non-error and
        // keep polling — the supplier may submit while the panel is open.
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('no translation task')) {
          setError(message);
        }
      }
      if (!cancelledRef.current) {
        timer = window.setTimeout(poll, pollIntervalMs);
      }
    };

    let timer = window.setTimeout(poll, 0);
    return () => {
      cancelledRef.current = true;
      window.clearTimeout(timer);
    };
  }, [productId, active, pollIntervalMs]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await supplierProductService.retryTranslation(productId);
      // Reset local status so the spinner shows immediately; the polling
      // effect will pick up the new task on its next tick.
      setStatus((prev) => (prev ? { ...prev, status: 'pending', retries: 0, last_error: undefined } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(false);
    }
  };

  if (!active) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Chinese preview (auto-translated)</span>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>
      {!collapsed && (
        <div className={styles.body}>
          <StatusRow status={status} error={error} retrying={retrying} onRetry={handleRetry} />
          {status?.status === 'success' && status.preview && (
            <PreviewBody preview={status.preview} />
          )}
        </div>
      )}
    </div>
  );
};

function isTerminal(s: TranslationTaskStatus): boolean {
  return s === 'success' || s === 'failed';
}

const StatusRow: React.FC<{
  status: TranslationStatus | null;
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
        <span>Translating to Chinese (typically &lt; 8s)…</span>
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

const PreviewBody: React.FC<{ preview: NonNullable<TranslationStatus['preview']> }> = ({ preview }) => {
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
