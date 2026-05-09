import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { ApiError } from '../../../services/api';
import type {
  BatchStockOp,
  BatchStockRequest,
  BatchStockResponse,
} from '../../../services/adminService';
import styles from './BatchStockModal.module.css';

export interface BatchStockModalProps {
  open: boolean;
  onClose: () => void;
  /** Product IDs the user selected on the list page. */
  productIds: number[];
  /** Persists the batch through admin or supplier service. */
  saveBatch: (req: BatchStockRequest) => Promise<BatchStockResponse>;
  /** Called after a successful save so the parent can refetch + clear selection. */
  onSaved?: (result: BatchStockResponse) => void;
}

const OPS: BatchStockOp[] = ['add', 'sub', 'set', 'zero'];

/**
 * REQ-20260509-0035 Phase 3b — list-page batch stock toolbar.
 * 4 ops mirror the single-row modal (add/sub/set/zero). For set/zero the
 * user must check a confirm box before submit, since these operations
 * force-overwrite unlimited (-1) packages and any ongoing reservations
 * (defect-analysis #2: unlimited→limited drops the implicit "无限量"
 * stock_sold accounting). The confirm is unconditional — the list-page
 * GET doesn't carry packages so we can't precount unlimited rows here.
 */
export const BatchStockModal: React.FC<BatchStockModalProps> = ({
  open,
  onClose,
  productIds,
  saveBatch,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [op, setOp] = useState<BatchStockOp>('add');
  const [valueStr, setValueStr] = useState('1');
  const [confirmedOverwrite, setConfirmedOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<BatchStockResponse | null>(null);

  useEffect(() => {
    if (open) {
      setOp('add');
      setValueStr('1');
      setConfirmedOverwrite(false);
      setSubmitting(false);
      setError(null);
      setSuccessResult(null);
    }
  }, [open]);

  const requiresOverwriteConfirm = op === 'set' || op === 'zero';
  const value = op === 'zero' ? 0 : Math.max(0, parseInt(valueStr, 10) || 0);
  const valueValid = op === 'zero'
    ? true
    : (op === 'set' ? value >= 0 && valueStr !== '' : value > 0);
  const canSubmit = !submitting
    && valueValid
    && productIds.length > 0
    && (!requiresOverwriteConfirm || confirmedOverwrite);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const req: BatchStockRequest = {
        product_ids: productIds,
        operation: op,
        ...(op === 'zero' ? {} : { value }),
      };
      const result = await saveBatch(req);
      setSuccessResult(result);
      onSaved?.(result);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      const data = err instanceof ApiError ? (err.data as Record<string, unknown> | undefined) : undefined;
      if (code === 'STOCK_BELOW_SOLD') {
        const conflicts = (data?.conflicting_packages as Array<unknown>) || [];
        setError(t('batchStock.errorBelowSold', {
          defaultValue: '部分套餐 stock_total 不能低于已售数量（{{n}} 个冲突）。请先取消相关订单或缩小批量范围。',
          n: conflicts.length,
        }) as string);
      } else if (code === 'BATCH_FORBIDDEN') {
        setError(t('batchStock.errorForbidden', { defaultValue: '部分商品不属于当前账户。' }) as string);
      } else if (code === 'BATCH_PRODUCT_NOT_FOUND') {
        setError(t('batchStock.errorMissing', { defaultValue: '部分商品已不存在，请刷新列表后重试。' }) as string);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const opLabel = (o: BatchStockOp): string => {
    switch (o) {
      case 'add':  return t('batchStock.opAdd',  { defaultValue: '全部 +N 增量' }) as string;
      case 'sub':  return t('batchStock.opSub',  { defaultValue: '全部 -N 减量' }) as string;
      case 'set':  return t('batchStock.opSet',  { defaultValue: '全部设为 N' }) as string;
      case 'zero': return t('batchStock.opZero', { defaultValue: '一键归零（停售）' }) as string;
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>
              {t('batchStock.title', { defaultValue: '批量调整库存' })}
            </h3>
            <div className={styles.subtitle}>
              {t('batchStock.subtitle', {
                defaultValue: '已选 {{n}} 个商品',
                n: productIds.length,
              })}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.opGroup}>
            {OPS.map((o) => (
              <label
                key={o}
                className={clsx(styles.opOption, op === o && styles.opOptionActive)}
              >
                <input
                  type="radio"
                  className={styles.opRadio}
                  checked={op === o}
                  onChange={() => {
                    setOp(o);
                    setConfirmedOverwrite(false);
                    setError(null);
                  }}
                />
                {opLabel(o)}
              </label>
            ))}
          </div>

          {op !== 'zero' && (
            <div className={styles.valueRow}>
              <label className={styles.valueLabel}>
                {op === 'set'
                  ? t('batchStock.valueLabelSet', { defaultValue: '目标库存（每套餐）' })
                  : t('batchStock.valueLabelDelta', { defaultValue: '增减量（每套餐）' })}
              </label>
              <input
                type="number"
                className={styles.valueInput}
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                min={op === 'set' ? '0' : '1'}
                step="1"
                disabled={submitting}
              />
            </div>
          )}

          <div className={styles.summary}>
            {op === 'add' && t('batchStock.summaryAdd', {
              defaultValue: '将给选中商品的每个套餐 stock_total +{{n}}（无限量套餐跳过）。',
              n: value,
            })}
            {op === 'sub' && t('batchStock.summarySub', {
              defaultValue: '将给选中商品的每个套餐 stock_total -{{n}}（不会低于已售；无限量套餐跳过）。',
              n: value,
            })}
            {op === 'set' && t('batchStock.summarySet', {
              defaultValue: '将选中商品的每个套餐 stock_total 设为 {{n}}（含无限量套餐）。',
              n: value,
            })}
            {op === 'zero' && t('batchStock.summaryZero', {
              defaultValue: '将选中商品的每个套餐 stock_total 设为 0（停售；含无限量套餐）。',
            })}
          </div>

          {requiresOverwriteConfirm && (
            <div className={styles.warning}>
              <div style={{ marginBottom: 8 }}>
                {t('batchStock.overwriteWarning', {
                  defaultValue:
                    '⚠️ Set / Zero 会强制覆写所有套餐 stock_total，包含无限量（-1）套餐。无限量套餐过去不累计 stock_sold，转有限后历史已售订单不计入新上限——如需精确控盘请退出后用单行调整。',
                })}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={confirmedOverwrite}
                  onChange={(e) => setConfirmedOverwrite(e.target.checked)}
                />
                {t('batchStock.overwriteConfirmCheckbox', {
                  defaultValue: '我已了解风险，确认覆写',
                })}
              </label>
            </div>
          )}

          {error && <div className={styles.errorBanner}>{error}</div>}

          {successResult && (
            <div className={styles.successBanner}>
              {t('batchStock.successAll', {
                defaultValue: '已更新 {{products}} 个商品 / {{packages}} 个套餐{{skipped}}',
                products: successResult.updated_products,
                packages: successResult.updated_packages,
                skipped: successResult.skipped_unlimited > 0
                  ? `，跳过 ${successResult.skipped_unlimited} 个无限量套餐`
                  : '',
              })}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
            {successResult
              ? t('common.close', { defaultValue: '关闭' })
              : t('common.cancel', { defaultValue: '取消' })}
          </button>
          {!successResult && (
            <button
              className={clsx(
                styles.applyBtn,
                requiresOverwriteConfirm && styles.applyBtnDanger,
              )}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting && <Loader2 size={14} className={styles.spin} />}
              {t('batchStock.apply', { defaultValue: '应用' })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchStockModal;
