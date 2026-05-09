import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { ApiError } from '../../../services/api';
import type { ApiProductPackage, ApiProduct } from '../../../services/productService';
import styles from './StockAdjustModal.module.css';

export interface StockAdjustModalProps {
  productId: number | null;
  productName?: string;
  open: boolean;
  onClose: () => void;
  /** Called after at least one successful save so the parent can refresh. */
  onSaved?: () => void;

  /**
   * Lazy-loads the product (with packages) when the modal opens. Accepts
   * either admin or supplier service so the modal stays role-agnostic.
   */
  loadProduct: (id: number) => Promise<ApiProduct>;
  /** Persists the new stock_total for a single package. */
  saveStock: (productId: number, packageId: number, stockTotal: number) => Promise<{
    id: number;
    stock_total: number;
    stock_sold: number;
  }>;
}

interface DraftRow {
  id: number;
  name_zh: string;
  name_en: string;
  stock_total: number;       // -1 = unlimited
  stock_sold: number;
  draftTotal: string;        // string for input editing; '' = unlimited
  saving?: boolean;
  error?: string;
}

/**
 * REQ-20260509-0035 Phase 2/3a: 列表页快速调整库存。打开时拉商品全量包列表，
 * 让运营改 stock_total（或勾"无限量"），逐个 PATCH。绕开 UpdateProduct
 * 的 delete-recreate 重型流程，不触发翻译/审核重置。
 *
 * Phase 3a 重构：从 Admin/ 提到 Common/，通过 loadProduct + saveStock 两个
 * 回调注入服务，admin 和 supplier 共用同一个 modal。
 */
export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  productId,
  productName,
  open,
  onClose,
  onSaved,
  loadProduct,
  saveStock,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const fetchPackages = useCallback(async (id: number) => {
    setLoading(true);
    setGlobalError(null);
    try {
      const product = await loadProduct(id);
      const pkgs = (product.packages || []) as ApiProductPackage[];
      setRows(pkgs.map((p) => {
        const total = p.stock_total ?? -1;
        return {
          id: p.id,
          name_zh: p.name_zh,
          name_en: p.name_en,
          stock_total: total,
          stock_sold: p.stock_sold ?? 0,
          draftTotal: total === -1 ? '' : String(total),
        };
      }));
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadProduct]);

  useEffect(() => {
    if (open && productId != null) {
      setSavedCount(0);
      fetchPackages(productId);
    }
  }, [open, productId, fetchPackages]);

  const handleDraftChange = (id: number, value: string) => {
    setRows((prev) => prev.map((r) =>
      r.id === id ? { ...r, draftTotal: value, error: undefined } : r,
    ));
  };

  const handleUnlimitedToggle = (id: number, checked: boolean) => {
    setRows((prev) => prev.map((r) =>
      r.id === id ? { ...r, draftTotal: checked ? '' : '0', error: undefined } : r,
    ));
  };

  const handleSaveRow = async (row: DraftRow) => {
    if (productId == null) return;
    const newTotal = row.draftTotal === '' ? -1 : Math.max(0, parseInt(row.draftTotal, 10));
    if (Number.isNaN(newTotal)) {
      setRows((prev) => prev.map((r) =>
        r.id === row.id ? { ...r, error: t('admin.stockAdjust.invalidNumber', '请输入有效的数字') as string } : r,
      ));
      return;
    }
    if (newTotal === row.stock_total) return; // no change

    setRows((prev) => prev.map((r) =>
      r.id === row.id ? { ...r, saving: true, error: undefined } : r,
    ));

    try {
      const result = await saveStock(productId, row.id, newTotal);
      setRows((prev) => prev.map((r) =>
        r.id === row.id
          ? { ...r, stock_total: result.stock_total, stock_sold: result.stock_sold, draftTotal: result.stock_total === -1 ? '' : String(result.stock_total), saving: false }
          : r,
      ));
      setSavedCount((c) => c + 1);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      const msg = code === 'STOCK_BELOW_SOLD'
        ? t('admin.stockAdjust.belowSold', '不能低于已售数量。先取消订单释放已售数。')
        : (err instanceof Error ? err.message : String(err));
      setRows((prev) => prev.map((r) =>
        r.id === row.id ? { ...r, saving: false, error: msg as string } : r,
      ));
    }
  };

  const handleClose = () => {
    if (savedCount > 0) onSaved?.();
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>{t('admin.stockAdjust.title', '调整库存')}</h3>
            {productName && <div className={styles.subtitle}>{productName}</div>}
          </div>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {loading && (
            <div className={styles.loading}>
              <Loader2 size={20} className={styles.spin} />
              <span>{t('common.loading', '加载中...')}</span>
            </div>
          )}
          {globalError && <div className={styles.errorBanner}>{globalError}</div>}
          {!loading && !globalError && rows.length === 0 && (
            <div className={styles.empty}>{t('admin.stockAdjust.noPackages', '该商品没有套餐')}</div>
          )}
          {!loading && rows.map((row) => (
            <div key={row.id} className={styles.row}>
              <div className={styles.rowName}>
                <div className={styles.rowNameZh}>{row.name_zh || row.name_en || `Package #${row.id}`}</div>
                {row.name_en && row.name_zh && <div className={styles.rowNameEn}>{row.name_en}</div>}
              </div>
              <div className={styles.rowControls}>
                <input
                  type="number"
                  className={styles.stockInput}
                  value={row.draftTotal}
                  placeholder={t('supplier.productForm.packageStockUnlimited', '无限量') as string}
                  disabled={row.draftTotal === ''}
                  onChange={(e) => handleDraftChange(row.id, e.target.value)}
                  min="0"
                  step="1"
                />
                <label className={styles.unlimitedLabel}>
                  <input
                    type="checkbox"
                    checked={row.draftTotal === ''}
                    onChange={(e) => handleUnlimitedToggle(row.id, e.target.checked)}
                  />
                  {t('supplier.productForm.packageStockUnlimited', '无限量')}
                </label>
                {row.stock_sold > 0 && (
                  <span className={styles.soldBadge}>
                    {t('admin.stockAdjust.sold', '已售 {{n}}', { n: row.stock_sold })}
                  </span>
                )}
                <button
                  className={styles.saveBtn}
                  onClick={() => handleSaveRow(row)}
                  disabled={
                    row.saving ||
                    (row.draftTotal === '' ? row.stock_total === -1 : Number(row.draftTotal) === row.stock_total)
                  }
                >
                  {row.saving ? <Loader2 size={14} className={styles.spin} /> : t('common.save', '保存')}
                </button>
              </div>
              {row.error && <div className={styles.rowError}>{row.error}</div>}
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <button className={styles.footerBtn} onClick={handleClose}>
            {t('common.close', '关闭')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockAdjustModal;
