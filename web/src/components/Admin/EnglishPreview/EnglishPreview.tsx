import React, { useEffect, useRef, useState } from 'react';
import {
  adminService,
  type EnTranslationStatus,
  type EnTranslationTaskStatus,
} from '../../../services/adminService';
import styles from './EnglishPreview.module.css';

export interface EnglishPreviewProps {
  /** Product ID whose latest ZH→EN task we poll. */
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
 * Read-only English translation preview for an admin-edited product.
 *
 * REQ-20260509-0004: admins write Chinese, the AI generates English. Mirror
 * of the supplier-side `ChinesePreview`, just pointed at the admin endpoints
 * and wired to *_en fields. Editing the EN side directly remains a future
 * Wave 2 capability — for now the admin overrides via the manual_override_en
 * flag toggled in the form, then enters EN manually in the existing fields.
 */
export const EnglishPreview: React.FC<EnglishPreviewProps> = ({
  productId,
  active = true,
  pollIntervalMs = 2000,
}) => {
  const [status, setStatus] = useState<EnTranslationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    cancelledRef.current = false;

    const poll = async () => {
      try {
        const resp = await adminService.getEnTranslationStatus(productId);
        if (cancelledRef.current) return;
        if (resp) {
          setStatus(resp);
          setError(null);
          if (isTerminal(resp.status)) return; // stop polling
        }
      } catch (err) {
        // 404 = no task yet (e.g. brand-new product before first save).
        // Keep polling — the next save by the admin will enqueue one.
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('no zh2en translation task')) {
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
      await adminService.retryEnTranslation(productId);
      setStatus((prev) =>
        prev ? { ...prev, status: 'pending', retries: 0, last_error: undefined } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await adminService.regenerateEnTranslation(productId);
      setStatus((prev) =>
        prev ? { ...prev, status: 'pending', retries: 0, last_error: undefined } : prev,
      );
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
        <span>English preview (auto-translated from 中文)</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.regenBtn}
            onClick={handleRegenerate}
            disabled={regenerating}
            title="Force a fresh ZH→EN translation against the latest Chinese fields"
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
          <StatusRow status={status} error={error} retrying={retrying} onRetry={handleRetry} />
          {status?.status === 'success' && status.preview && (
            <PreviewBody preview={status.preview} />
          )}
        </div>
      )}
    </div>
  );
};

function isTerminal(s: EnTranslationTaskStatus): boolean {
  return s === 'success' || s === 'failed';
}

const StatusRow: React.FC<{
  status: EnTranslationStatus | null;
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
        <span>Translating to English (typically &lt; 8s)…</span>
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

const PreviewBody: React.FC<{ preview: NonNullable<EnTranslationStatus['preview']> }> = ({ preview }) => {
  const fields: Array<{ key: keyof typeof preview; label: string }> = [
    { key: 'name_en', label: 'Name (English)' },
    { key: 'summary_en', label: 'Summary (English)' },
    { key: 'description_en', label: 'Description (English)' },
    { key: 'address_en', label: 'Address (English)' },
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

export default EnglishPreview;
