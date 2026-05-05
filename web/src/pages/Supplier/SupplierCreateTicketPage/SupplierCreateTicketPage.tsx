import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listSupplierOrders, type Order } from '../../../services/orderService';
import {
  createSupplierTicket,
  uploadTicketImage,
  type SupplierCreateTicketPayload,
} from '../../../services/aftersalesService';
import styles from './SupplierCreateTicketPage.module.css';

const MAX_IMAGES = 9;
const TYPES: SupplierCreateTicketPayload['type'][] = ['refund', 'exchange', 'complaint', 'inquiry'];
const PRIORITIES: NonNullable<SupplierCreateTicketPayload['priority']>[] = ['low', 'medium', 'high'];

export interface SupplierCreateTicketPageProps {
  prefillOrderId?: number;
  onNavigate?: (path: string) => void;
}

export const SupplierCreateTicketPage: React.FC<SupplierCreateTicketPageProps> = ({
  prefillOrderId,
  onNavigate,
}) => {
  const { t } = useTranslation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [orderId, setOrderId] = useState<number>(prefillOrderId ?? 0);
  const [type, setType] = useState<SupplierCreateTicketPayload['type']>('refund');
  const [priority, setPriority] = useState<NonNullable<SupplierCreateTicketPayload['priority']>>('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<{ url: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load supplier's orders for the dropdown.
  useEffect(() => {
    let cancelled = false;
    setLoadingOrders(true);
    listSupplierOrders({ page: 1, page_size: 100 })
      .then((res) => {
        if (cancelled) return;
        setOrders(res.items || []);
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-pick first order if none preselected and list arrived.
  useEffect(() => {
    if (!orderId && orders.length > 0) {
      setOrderId(orders[0].id);
    }
  }, [orderId, orders]);

  const orderOptions = useMemo(
    () =>
      orders.map((o) => ({
        id: o.id,
        label: `#${o.order_no} · ${o.product_name} · ${o.user_name}`,
      })),
    [orders],
  );

  const handlePickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    const slice = files.slice(0, remaining);
    setUploading(true);
    setError(null);
    try {
      for (const f of slice) {
        if (!f.type.startsWith('image/')) continue;
        const preview = URL.createObjectURL(f);
        try {
          const url = await uploadTicketImage(f);
          setImages((prev) => [...prev, { url, preview }]);
        } catch (uploadErr) {
          URL.revokeObjectURL(preview);
          throw uploadErr;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (preview: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.preview === preview);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((i) => i.preview !== preview);
    });
  };

  const canSubmit =
    orderId > 0 && subject.trim().length > 0 && !submitting && !uploading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createSupplierTicket({
        order_id: orderId,
        type,
        priority,
        subject: subject.trim(),
        description: description.trim() || undefined,
        image_urls: images.map((i) => i.url),
      });
      // Free preview URLs.
      images.forEach((i) => URL.revokeObjectURL(i.preview));
      onNavigate?.(`/supplier/after-sales/${result.ticket.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {t('supplier.afterSales.createTicketTitle', { defaultValue: '新建售后单' })}
        </h1>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => onNavigate?.('/supplier/after-sales')}
        >
          ← {t('common.back', { defaultValue: '返回' })}
        </button>
      </div>

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>
            {t('supplier.afterSales.fieldOrder', { defaultValue: '关联订单' })}
            <span className={styles.required}>*</span>
          </label>
          <select
            className={styles.select}
            value={orderId}
            onChange={(e) => setOrderId(Number(e.target.value))}
            disabled={loadingOrders || orders.length === 0}
          >
            {loadingOrders && <option value={0}>{t('common.loading', { defaultValue: '加载中…' })}</option>}
            {!loadingOrders && orders.length === 0 && (
              <option value={0}>{t('supplier.afterSales.noOrders', { defaultValue: '暂无可选订单' })}</option>
            )}
            {orderOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            {t('supplier.afterSales.fieldType', { defaultValue: '类型' })}
            <span className={styles.required}>*</span>
          </label>
          <select
            className={styles.select}
            value={type}
            onChange={(e) => setType(e.target.value as SupplierCreateTicketPayload['type'])}
          >
            {TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {t(`supplier.afterSales.type.${tp}`, { defaultValue: tp })}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            {t('supplier.afterSales.fieldPriority', { defaultValue: '优先级' })}
          </label>
          <select
            className={styles.select}
            value={priority}
            onChange={(e) => setPriority(e.target.value as NonNullable<SupplierCreateTicketPayload['priority']>)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`supplier.afterSales.priority.${p}`, { defaultValue: p })}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            {t('supplier.afterSales.fieldSubject', { defaultValue: '主题' })}
            <span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            className={styles.input}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder={
              t('supplier.afterSales.subjectPlaceholder', { defaultValue: '简要描述问题…' }) as string
            }
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            {t('supplier.afterSales.fieldDescription', { defaultValue: '详细说明' })}
          </label>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            placeholder={
              t('supplier.afterSales.descriptionPlaceholder', {
                defaultValue: '提供更多上下文，便于平台快速处理…',
              }) as string
            }
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            {t('supplier.afterSales.fieldAttachments', { defaultValue: '凭证图片' })} ({images.length}/{MAX_IMAGES})
          </label>
          <div className={styles.attachmentsRow}>
            {images.map((img) => (
              <div key={img.preview} className={styles.thumb}>
                <img src={img.preview} alt="evidence" />
                <button
                  type="button"
                  className={styles.thumbRemove}
                  onClick={() => removeImage(img.preview)}
                >
                  ✕
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handlePickFiles}
                />
                <button
                  type="button"
                  className={`${styles.uploadTrigger} ${uploading ? styles.uploading : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading
                    ? t('common.uploading', { defaultValue: '上传中…' })
                    : t('supplier.afterSales.addImage', { defaultValue: '+ 添加图片' })}
                </button>
              </>
            )}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => onNavigate?.('/supplier/after-sales')}
            disabled={submitting}
          >
            {t('common.cancel', { defaultValue: '取消' })}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting
              ? t('common.submitting', { defaultValue: '提交中…' })
              : t('supplier.afterSales.submit', { defaultValue: '提交售后单' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierCreateTicketPage;
