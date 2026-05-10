/**
 * REQ-20260510-0001 · dev-3 — Admin bilingual preview wrapper.
 *
 * Embedded inside AdminProductFormPage when ?mode=preview. Renders the
 * draft product side-by-side in ZH and EN by feeding ProductDetailPage's
 * previewData prop (REQ-20260510-0001 F1) directly from the form state —
 * no API fetch, so the admin sees their unsaved edits.
 *
 * Field-level inline edit follows the analysis-stage R2 + R6 decisions:
 *   - Click-on-text contentEditable was rejected (IME / diff complexity).
 *   - Toolbar of chips for the 8 whitelisted text fields (title / subtitle /
 *     description / cancellation / itinerary / highlights / inclusions /
 *     exclusions). Click chip → modal with side-by-side ZH + EN inputs.
 *   - Save calls back to the parent which PUTs the product with
 *     manual_override_zh|en flagged (sticking to 0015's flag semantics).
 *
 * Multi-tab guard: BroadcastChannel mirrors the supplier preview page so
 * editing the same product in two tabs surfaces a yellow warning banner.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import { ApiError } from '../../../services/api';
import { ProductDetailPage } from '../../../pages/ProductDetailPage/ProductDetailPage';
import type { Product } from '../../../types';
import styles from './AdminBilingualPreview.module.css';

// ── Field whitelist ─────────────────────────────────────────────────────
// Locked to the 8 fields the analysis stage flagged for inline-edit. Anyone
// adding a 9th field MUST update the analysis decision (R6) — silent growth
// of the whitelist is the easy way for "preview-only edits" to leak into
// scope creep. Sub-tables (highlights[].desc, packages[], FAQ) explicitly
// stay out per R6.
export type EditableField =
  | 'title'
  | 'subtitle'
  | 'description'
  | 'highlights'    // joined newline-separated
  | 'inclusions'    // joined newline-separated
  | 'exclusions'    // joined newline-separated
  | 'cancellation'
  | 'itinerary';

export interface BilingualText {
  zh: string;
  en: string;
}

/** Snapshot of the manual_override flags from the loaded product. */
export interface ManualOverrideFlags {
  zh: boolean;
  en: boolean;
}

export interface AdminBilingualPreviewProps {
  /** Draft built from the form state via formToProduct(). */
  previewData: Product;
  /** Backing product ID for the BroadcastChannel multi-tab guard. */
  productId?: string;
  /** Bilingual text values keyed by EditableField. Required only when the
   *  inline-edit toolbar is enabled (onFieldSave provided). */
  values?: Record<EditableField, BilingualText>;
  /** Per-field manual_override flags; drives the chip color (manual chip
   *  is amber so the admin sees at a glance which fields they own).
   *  Only consulted when onFieldSave is provided. */
  flags?: Record<EditableField, ManualOverrideFlags>;
  /** Save callback — when provided, the toolbar of editable-field chips
   *  + the inline-edit modal render. When omitted, the component is a
   *  pure read-only dual-column preview (the path REQ-20260510-0001
   *  dev-3 ships first; inline-edit lands in a follow-up that adds the
   *  backend PATCH endpoint to flip manual_override_* atomically). */
  onFieldSave?: (
    field: EditableField,
    next: BilingualText,
    sides: { zh: boolean; en: boolean },
  ) => Promise<void>;
}

const FIELD_TEXTAREA: Record<EditableField, boolean> = {
  title: false,
  subtitle: false,
  description: true,
  highlights: true,
  inclusions: true,
  exclusions: true,
  cancellation: true,
  itinerary: true,
};

export const AdminBilingualPreview: React.FC<AdminBilingualPreviewProps> = ({
  previewData,
  productId,
  values,
  flags,
  onFieldSave,
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [multiTabWarning, setMultiTabWarning] = useState(false);
  const editableEnabled = Boolean(onFieldSave && values && flags);

  // BroadcastChannel mirrors SupplierProductPreviewBilingualPage so a tab
  // opened on the same product (in either supplier or admin context) shows
  // the warning. Same channel name as supplier — they share the lock so
  // edits don't fight across roles either.
  useEffect(() => {
    if (!productId || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('enjoysa-product-edit');
    const tabId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    ch.postMessage({ type: 'open', productId, tabId });
    ch.onmessage = (e) => {
      if (e.data?.type === 'open' && e.data.productId === productId && e.data.tabId !== tabId) {
        setMultiTabWarning(true);
        ch.postMessage({ type: 'already_open', productId, tabId });
      }
      if (e.data?.type === 'already_open' && e.data.productId === productId && e.data.tabId !== tabId) {
        setMultiTabWarning(true);
      }
    };
    return () => {
      ch.postMessage({ type: 'close', productId, tabId });
      ch.close();
    };
  }, [productId]);

  const fields: EditableField[] = useMemo(
    () => ['title', 'subtitle', 'description', 'highlights', 'inclusions', 'exclusions', 'cancellation', 'itinerary'],
    [],
  );

  const fieldLabel = (f: EditableField) =>
    t(`adminBilingualPreview.field.${f}`, {
      defaultValue: ({
        title: '标题', subtitle: '副标题', description: '描述',
        highlights: '亮点', inclusions: '包含项', exclusions: '不含项',
        cancellation: '取消政策', itinerary: '行程',
      })[f],
    }) as string;

  return (
    <div className={styles.shell}>
      {editableEnabled && (
        <div className={styles.toolbar}>
          <span className={styles.toolbarLabel}>
            {t('adminBilingualPreview.toolbarLabel', { defaultValue: '编辑字段：' })}
          </span>
          {fields.map((f) => {
            const isManual = flags?.[f]?.zh || flags?.[f]?.en;
            return (
              <button
                key={f}
                type="button"
                className={clsx(styles.fieldChip, isManual && styles.fieldChipManual)}
                onClick={() => setEditing(f)}
                title={isManual
                  ? (t('adminBilingualPreview.flagManual', { defaultValue: '已人工覆盖' }) as string)
                  : (t('adminBilingualPreview.flagAuto', { defaultValue: 'AI 翻译' }) as string)}
              >
                {fieldLabel(f)}
                {isManual && ' ●'}
              </button>
            );
          })}
        </div>
      )}

      {multiTabWarning && (
        <div className={clsx(styles.banner, styles.bannerMultiTab)}>
          ⚠️ {t('adminBilingualPreview.multiTabWarning', { defaultValue: '该商品已在另一窗口打开，编辑可能互相覆盖' })}
        </div>
      )}

      <div className={styles.columnsContainer}>
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <span className={styles.columnLabel}>🇨🇳 中文落地页</span>
          </div>
          <div className={styles.columnBody}>
            <ProductDetailPage previewMode previewData={previewData} language="zh" />
          </div>
        </div>
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <span className={styles.columnLabel}>🇬🇧 English landing</span>
          </div>
          <div className={styles.columnBody}>
            <ProductDetailPage previewMode previewData={previewData} language="en" />
          </div>
        </div>
      </div>

      {editing && editableEnabled && values && flags && onFieldSave && (
        <InlineEditModal
          field={editing}
          fieldLabel={fieldLabel(editing)}
          textarea={FIELD_TEXTAREA[editing]}
          initial={values[editing]}
          flags={flags[editing]}
          onClose={() => setEditing(null)}
          onSave={onFieldSave}
        />
      )}
    </div>
  );
};

// ── Inline-edit modal ───────────────────────────────────────────────────

interface InlineEditModalProps {
  field: EditableField;
  fieldLabel: string;
  textarea: boolean;
  initial: BilingualText;
  flags: ManualOverrideFlags;
  onClose: () => void;
  onSave: (
    field: EditableField,
    next: BilingualText,
    sides: { zh: boolean; en: boolean },
  ) => Promise<void>;
}

const InlineEditModal: React.FC<InlineEditModalProps> = ({
  field,
  fieldLabel,
  textarea,
  initial,
  flags,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [zh, setZh] = useState(initial.zh);
  const [en, setEn] = useState(initial.en);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirtyZh = zh !== initial.zh;
  const dirtyEn = en !== initial.en;
  const dirty = dirtyZh || dirtyEn;

  const handleSave = async () => {
    if (!dirty) {
      onClose();
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(field, { zh, en }, { zh: dirtyZh, en: dirtyEn });
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const InputCmp = textarea ? 'textarea' : 'input';

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {t('adminBilingualPreview.editTitle', {
              defaultValue: '编辑 {{field}}',
              field: fieldLabel,
            })}
          </h3>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalGrid}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                <span>🇨🇳 中文</span>
                <span className={clsx(styles.flagPill, flags.zh && styles.flagPillManual)}>
                  {flags.zh ? 'manual' : 'auto'}
                </span>
              </label>
              <InputCmp
                className={textarea ? styles.fieldTextarea : styles.fieldInput}
                value={zh}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setZh(e.target.value)}
                disabled={saving}
              />
              {dirtyZh && (
                <span className={styles.fieldHint}>
                  {t('adminBilingualPreview.willMarkManual', {
                    defaultValue: '保存后该字段标记为人工覆盖',
                  })}
                </span>
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                <span>🇬🇧 English</span>
                <span className={clsx(styles.flagPill, flags.en && styles.flagPillManual)}>
                  {flags.en ? 'manual' : 'auto'}
                </span>
              </label>
              <InputCmp
                className={textarea ? styles.fieldTextarea : styles.fieldInput}
                value={en}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEn(e.target.value)}
                disabled={saving}
              />
              {dirtyEn && (
                <span className={styles.fieldHint}>
                  {t('adminBilingualPreview.willMarkManual', {
                    defaultValue: '保存后该字段标记为人工覆盖',
                  })}
                </span>
              )}
            </div>
          </div>
          {error && <div className={styles.modalErrorBanner}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.modalCancelBtn} onClick={onClose} disabled={saving}>
            {t('common.cancel', { defaultValue: '取消' })}
          </button>
          <button
            className={styles.modalSaveBtn}
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving && <Loader2 size={14} className={styles.spin} />}
            {t('common.save', { defaultValue: '保存' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminBilingualPreview;
