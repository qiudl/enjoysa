import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './FormBatchStockBar.module.css';

export type FormBatchStockOp = 'add' | 'sub' | 'set' | 'zero';

export interface FormBatchPackage {
  _id: string;
  name_zh?: string;
  name_en?: string;
  stock_total?: number;
  stock_sold?: number;
}

export interface FormBatchStockBarProps {
  packages: FormBatchPackage[];
  /** Receives a Map of _id → new stock_total. Parent applies via setPackages. */
  onApply: (changes: Map<string, number>) => void;
}

const OPS: FormBatchStockOp[] = ['add', 'sub', 'set', 'zero'];

interface ApplyOutcome {
  applied: number;
  skippedUnlimited: number;
  skippedBelowSold: Array<{ name: string; stock_sold: number }>;
}

/**
 * REQ-20260509-0035 Phase 3c — inline batch toolbar inside ProductForm.
 * Operates on the form's draft packages[] state only; no network call.
 * 4 ops mirror Phase 3b semantics:
 *   add(v>0)  : -1 packages skip; else stock_total += v
 *   sub(v>0)  : -1 packages skip; else max(stock_sold, stock_total - v)
 *   set(v>=0) : overwrite all (incl -1); skip rows where v < stock_sold
 *   zero      : equivalent to set 0
 *
 * Unlike Phase 3b's batch endpoint (which 422s the whole batch on any
 * below-sold conflict), the form-side bar tolerates partial application:
 * conflicting rows stay untouched and are reported inline, while the
 * rest of the draft is updated. The user can keep editing freely.
 */
export const FormBatchStockBar: React.FC<FormBatchStockBarProps> = ({
  packages,
  onApply,
}) => {
  const { t } = useTranslation();
  const [op, setOp] = useState<FormBatchStockOp>('add');
  const [valueStr, setValueStr] = useState('1');
  const [outcome, setOutcome] = useState<ApplyOutcome | null>(null);

  const value = op === 'zero' ? 0 : Math.max(0, parseInt(valueStr, 10) || 0);
  const valueValid = op === 'zero'
    ? true
    : (op === 'set' ? value >= 0 && valueStr !== '' : value > 0);
  const canApply = packages.length > 0 && valueValid;

  const stats = useMemo(() => {
    let unlimited = 0;
    let withSold = 0;
    for (const p of packages) {
      if ((p.stock_total ?? -1) === -1) unlimited += 1;
      if ((p.stock_sold ?? 0) > 0) withSold += 1;
    }
    return { unlimited, withSold };
  }, [packages]);

  const handleApply = () => {
    if (!canApply) return;
    const changes = new Map<string, number>();
    let skippedUnlimited = 0;
    const skippedBelowSold: ApplyOutcome['skippedBelowSold'] = [];

    for (const p of packages) {
      const total = p.stock_total ?? -1;
      const sold = p.stock_sold ?? 0;
      const name = p.name_zh || p.name_en || `#${p._id.slice(-4)}`;

      let newTotal: number;
      switch (op) {
        case 'add':
          if (total === -1) { skippedUnlimited += 1; continue; }
          newTotal = total + value;
          break;
        case 'sub':
          if (total === -1) { skippedUnlimited += 1; continue; }
          newTotal = Math.max(sold, total - value);
          break;
        case 'set':
          if (value < sold) { skippedBelowSold.push({ name, stock_sold: sold }); continue; }
          newTotal = value;
          break;
        case 'zero':
          if (sold > 0) { skippedBelowSold.push({ name, stock_sold: sold }); continue; }
          newTotal = 0;
          break;
      }
      if (newTotal !== total) {
        changes.set(p._id, newTotal);
      }
    }

    if (changes.size > 0) onApply(changes);
    setOutcome({ applied: changes.size, skippedUnlimited, skippedBelowSold });
  };

  if (packages.length === 0) return null;

  const opLabel = (o: FormBatchStockOp): string => {
    switch (o) {
      case 'add':  return t('formBatchStock.opAdd',  { defaultValue: '+N' }) as string;
      case 'sub':  return t('formBatchStock.opSub',  { defaultValue: '-N' }) as string;
      case 'set':  return t('formBatchStock.opSet',  { defaultValue: '设为 N' }) as string;
      case 'zero': return t('formBatchStock.opZero', { defaultValue: '一键归零' }) as string;
    }
  };

  const isOverwriteOp = op === 'set' || op === 'zero';

  return (
    <div className={styles.bar}>
      <span className={styles.label}>
        {t('formBatchStock.label', { defaultValue: '批量库存：' })}
      </span>

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
              onChange={() => { setOp(o); setOutcome(null); }}
            />
            {opLabel(o)}
          </label>
        ))}
      </div>

      {op !== 'zero' && (
        <input
          type="number"
          className={styles.valueInput}
          value={valueStr}
          onChange={(e) => { setValueStr(e.target.value); setOutcome(null); }}
          min={op === 'set' ? '0' : '1'}
          step="1"
          aria-label={t('formBatchStock.value', { defaultValue: 'Value' }) as string}
        />
      )}

      <button
        type="button"
        className={clsx(styles.applyBtn, isOverwriteOp && styles.applyBtnDanger)}
        onClick={handleApply}
        disabled={!canApply}
      >
        {t('formBatchStock.apply', { defaultValue: '应用' })}
      </button>

      {/* Inline scope hint — always shown so the user knows what Apply will do
          before clicking. Includes the unlimited-overwrite warning for set/zero. */}
      <div className={styles.hint}>
        {t('formBatchStock.scope', {
          defaultValue: '将作用于全部 {{n}} 个套餐（含未保存修改）',
          n: packages.length,
        })}
        {isOverwriteOp && stats.unlimited > 0 && (
          <span className={styles.hintWarn}>
            {' · '}
            {t('formBatchStock.unlimitedWarn', {
              defaultValue: '⚠️ {{n}} 个无限量套餐将被覆写',
              n: stats.unlimited,
            })}
          </span>
        )}
      </div>

      {/* Apply outcome feedback. Stays until op/value changes. */}
      {outcome && (
        <>
          <div className={outcome.applied > 0 ? styles.hintSuccess : styles.hint}>
            {t('formBatchStock.applied', {
              defaultValue: '已更新 {{n}} 个套餐',
              n: outcome.applied,
            })}
            {outcome.skippedUnlimited > 0 && (
              <>
                {' · '}
                {t('formBatchStock.skippedUnlimited', {
                  defaultValue: '跳过 {{n}} 个无限量套餐',
                  n: outcome.skippedUnlimited,
                })}
              </>
            )}
          </div>
          {outcome.skippedBelowSold.length > 0 && (
            <div className={styles.hintError}>
              {t('formBatchStock.belowSoldHint', {
                defaultValue: '跳过 {{n}} 个含已售的套餐：{{names}}',
                n: outcome.skippedBelowSold.length,
                names: outcome.skippedBelowSold
                  .slice(0, 3)
                  .map((s) => `${s.name}(已售${s.stock_sold})`)
                  .join('、')
                  + (outcome.skippedBelowSold.length > 3 ? '…' : ''),
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FormBatchStockBar;
