// REQ-20260510-0002 · Phase 1 · 1F
//
// "💰 AI 建议价格" button + popover. Sits next to the price field; on click
// looks up the tourism_pricing_benchmarks row matching (category, council,
// duration_minutes), then renders median + P25/P75 + sample size + the
// agent's templated explanation. Insufficient_data (sample < 3) renders a
// "数据不足" banner instead of a misleading number.
//
// We deliberately do NOT auto-apply the suggested price — the supplier or
// admin has to type it in themselves. This avoids "AI silently changed my
// price" surprises and matches the requirement's "不强制采纳，仅作参考" rule.

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Loader2, X } from 'lucide-react';
import {
  tourismAgentService,
  type TourismPricingResponse,
} from '../../../services/tourismAgentService';
import styles from './TourismPricingButton.module.css';

export interface TourismPricingButtonProps {
  role: 'supplier' | 'admin';
  category?: string;
  council?: string;
  durationMinutes?: number;
  /** Optional callback so the form can pre-fill the price field on apply. */
  onApply?: (price: number) => void;
}

export const TourismPricingButton: React.FC<TourismPricingButtonProps> = ({
  role,
  category,
  council,
  durationMinutes,
  onApply,
}) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<TourismPricingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dimsReady = !!category && !!council && !!durationMinutes && durationMinutes > 0;

  const handleClick = async () => {
    if (!dimsReady || busy) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await tourismAgentService.pricingSuggest(
        {
          category: category!,
          council: council!,
          duration_minutes: durationMinutes!,
        },
        role,
      );
      setData(resp);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pricing lookup failed');
      setData(null);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        onClick={handleClick}
        disabled={!dimsReady || busy}
        title={
          !dimsReady
            ? t(
                'tourismAgent.pricing.disabledHint',
                '请先填写区域 (Council)、品类、典型时长后再用 AI 建议价格',
              )
            : t('tourismAgent.pricing.tooltip', '基于行情库给出价格建议')
        }
      >
        {busy ? <Loader2 size={14} className={styles.spin} /> : <DollarSign size={14} />}
        <span>
          {busy
            ? t('tourismAgent.pricing.busy', '查询中...')
            : t('tourismAgent.pricing.button', '💰 AI 建议价格')}
        </span>
      </button>

      {open && (
        <div className={styles.popover} role="dialog">
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setOpen(false)}
            aria-label="close"
          >
            <X size={14} />
          </button>

          {error && <div className={styles.errorBanner}>{error}</div>}

          {data && data.insufficient_data && (
            <div className={styles.insufficientBanner}>
              {t(
                'tourismAgent.pricing.insufficient',
                '样本不足（仅 {{n}} 个相似产品），暂不给出价格建议。',
                { n: data.sample_size },
              )}
            </div>
          )}

          {data && !data.insufficient_data && data.median !== undefined && (
            <>
              <div className={styles.medianRow}>
                <span className={styles.medianLabel}>
                  {t('tourismAgent.pricing.suggestion', '建议价')}
                </span>
                <span className={styles.medianValue}>
                  {data.currency} {data.median.toFixed(2)}
                </span>
              </div>
              {(data.p25 !== undefined || data.p75 !== undefined) && (
                <div className={styles.rangeRow}>
                  <span>P25 — P75:</span>
                  <strong>
                    {data.p25?.toFixed(2) ?? '—'} – {data.p75?.toFixed(2) ?? '—'}
                  </strong>
                </div>
              )}
              <div className={styles.metaRow}>
                <span>
                  {t('tourismAgent.pricing.samples', '样本 {{n}}', { n: data.sample_size })}
                </span>
                <span className={`${styles.confidence} ${styles[`confidence_${data.confidence}`] ?? ''}`}>
                  {data.confidence}
                </span>
              </div>
              {data.explanation && (
                <p className={styles.explanation}>{data.explanation}</p>
              )}
              {onApply && data.median !== undefined && (
                <button
                  type="button"
                  className={styles.applyBtn}
                  onClick={() => {
                    onApply(data.median!);
                    setOpen(false);
                  }}
                >
                  {t('tourismAgent.pricing.apply', '采用建议价')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TourismPricingButton;
