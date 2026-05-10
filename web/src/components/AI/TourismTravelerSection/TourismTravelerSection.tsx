// REQ-20260510-0011 · Phase 2 · 2A-4
//
// "南澳 AI 助你看看" — embedded section on ProductDetailPage with three
// independent buttons (💡 讲讲 / 🤔 适合我吗 / 📍 周边). Each button has
// its own collapsible result panel; users can open none, one, or all.
//
// Coexistence with the existing FitCheck (REQ-0007) component: that one
// uses a stored profile-driven check; ours uses a free-text "用一句话"
// check grounded in the SA tourism KB. Different angle, different audience
// — both stay on the page side-by-side.
//
// Anonymous-friendly: no login required, requests skip Authorization
// header. Server enforces 6 r/min/IP — surface 429s as friendly toast.

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, HelpCircle, MapPin, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  tourismCEndService,
  type TourismExplainResponse,
  type TourismFitCheckResponse,
  type TourismNearbyResponse,
} from '../../../services/tourismCEndService';
import styles from './TourismTravelerSection.module.css';

export interface TourismTravelerSectionProps {
  productId: number;
}

type PanelState<T> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: T }
  | { kind: 'err'; message: string };

const FIT_QUERY_MAX = 200;

export const TourismTravelerSection: React.FC<TourismTravelerSectionProps> = ({ productId }) => {
  const { t } = useTranslation();

  const [explainOpen, setExplainOpen] = useState(false);
  const [explainState, setExplainState] = useState<PanelState<TourismExplainResponse>>({ kind: 'idle' });

  const [fitOpen, setFitOpen] = useState(false);
  const [fitQuery, setFitQuery] = useState('');
  const [fitState, setFitState] = useState<PanelState<TourismFitCheckResponse>>({ kind: 'idle' });

  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyState, setNearbyState] = useState<PanelState<TourismNearbyResponse>>({ kind: 'idle' });

  // ─── Explain ──────────────────────────────────────────────────────────────
  const triggerExplain = useCallback(async () => {
    setExplainOpen(true);
    if (explainState.kind === 'ok' || explainState.kind === 'loading') return;
    setExplainState({ kind: 'loading' });
    try {
      const data = await tourismCEndService.explain(productId);
      setExplainState({ kind: 'ok', data });
    } catch (err) {
      setExplainState({
        kind: 'err',
        message: err instanceof Error ? err.message : 'AI generation failed',
      });
    }
  }, [productId, explainState.kind]);

  // ─── Fit check ────────────────────────────────────────────────────────────
  const triggerFitCheck = useCallback(async () => {
    const q = fitQuery.trim();
    if (q.length === 0) return;
    setFitState({ kind: 'loading' });
    try {
      const data = await tourismCEndService.fitCheck(productId, q);
      setFitState({ kind: 'ok', data });
    } catch (err) {
      setFitState({
        kind: 'err',
        message: err instanceof Error ? err.message : 'AI check failed',
      });
    }
  }, [productId, fitQuery]);

  // ─── Nearby ───────────────────────────────────────────────────────────────
  const triggerNearby = useCallback(async () => {
    setNearbyOpen(true);
    if (nearbyState.kind === 'ok' || nearbyState.kind === 'loading') return;
    setNearbyState({ kind: 'loading' });
    try {
      const data = await tourismCEndService.nearby(productId);
      setNearbyState({ kind: 'ok', data });
    } catch (err) {
      setNearbyState({
        kind: 'err',
        message: err instanceof Error ? err.message : 'Lookup failed',
      });
    }
  }, [productId, nearbyState.kind]);

  return (
    <section className={styles.wrapper} aria-labelledby="tourism-ai-title">
      <h2 id="tourism-ai-title" className={styles.title}>
        {t('tourismC.title', '南澳 AI 助你看看')}
      </h2>
      <p className={styles.subtitle}>
        {t('tourismC.subtitle', '基于平台南澳旅游知识库，给你三个角度看看这个产品')}
      </p>

      {/* ─── 💡 Explain ─────────────────────────────────────────────────── */}
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          onClick={() => (explainOpen ? setExplainOpen(false) : triggerExplain())}
          aria-expanded={explainOpen}
        >
          <Sparkles size={16} className={styles.icon} />
          {t('tourismC.explain.button', '💡 AI 讲讲这个')}
          {explainOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {explainOpen && (
          <div className={styles.panel} role="status">
            {explainState.kind === 'loading' && (
              <div className={styles.loading}>
                <Loader2 size={14} className={styles.spin} />{' '}
                {t('tourismC.explain.loading', '正在调用 AI ...')}
              </div>
            )}
            {explainState.kind === 'err' && <div className={styles.errorBanner}>{explainState.message}</div>}
            {explainState.kind === 'ok' && (
              <>
                <p className={styles.content}>{explainState.data.content}</p>
                {explainState.data.knowledge_refs.length > 0 && (
                  <p className={styles.refs}>
                    {t('tourismC.explain.refs', '基于 {{n}} 条知识库条目', {
                      n: explainState.data.knowledge_refs.length,
                    })}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── 🤔 Fit check ──────────────────────────────────────────────── */}
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          onClick={() => setFitOpen((v) => !v)}
          aria-expanded={fitOpen}
        >
          <HelpCircle size={16} className={styles.icon} />
          {t('tourismC.fit.button', '🤔 适合我吗？')}
          {fitOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {fitOpen && (
          <div className={styles.panel}>
            <textarea
              className={styles.input}
              value={fitQuery}
              maxLength={FIT_QUERY_MAX}
              placeholder={t('tourismC.fit.placeholder', '一句话告诉 AI（如 "带 5 岁小孩"）')}
              onChange={(e) => setFitQuery(e.target.value)}
              rows={2}
            />
            <div className={styles.fitFooter}>
              <span className={styles.privacyHint}>
                {t('tourismC.fit.privacy', '仅用于本次 AI 判断，不会保存')}
              </span>
              <span className={styles.charCount}>
                {fitQuery.length}/{FIT_QUERY_MAX}
              </span>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={triggerFitCheck}
              disabled={fitQuery.trim().length === 0 || fitState.kind === 'loading'}
            >
              {fitState.kind === 'loading' ? (
                <>
                  <Loader2 size={14} className={styles.spin} />{' '}
                  {t('tourismC.fit.checking', '判断中...')}
                </>
              ) : (
                t('tourismC.fit.submit', '让 AI 看看')
              )}
            </button>
            {fitState.kind === 'err' && <div className={styles.errorBanner}>{fitState.message}</div>}
            {fitState.kind === 'ok' && (
              <pre className={styles.fitResult}>{fitState.data.content}</pre>
            )}
          </div>
        )}
      </div>

      {/* ─── 📍 Nearby ─────────────────────────────────────────────────── */}
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          onClick={() => (nearbyOpen ? setNearbyOpen(false) : triggerNearby())}
          aria-expanded={nearbyOpen}
        >
          <MapPin size={16} className={styles.icon} />
          {t('tourismC.nearby.button', '📍 周边还有什么')}
          {nearbyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {nearbyOpen && (
          <div className={styles.panel}>
            {nearbyState.kind === 'loading' && (
              <div className={styles.loading}>
                <Loader2 size={14} className={styles.spin} />{' '}
                {t('tourismC.nearby.loading', '查询中...')}
              </div>
            )}
            {nearbyState.kind === 'err' && <div className={styles.errorBanner}>{nearbyState.message}</div>}
            {nearbyState.kind === 'ok' && nearbyState.data.items.length === 0 && (
              <div className={styles.empty}>{t('tourismC.nearby.empty', '该区域暂无更多 KB 推荐')}</div>
            )}
            {nearbyState.kind === 'ok' && nearbyState.data.items.length > 0 && (
              <ul className={styles.nearbyList}>
                {nearbyState.data.items.map((item) => (
                  <li key={`${item.type}:${item.id}`} className={styles.nearbyItem}>
                    <span className={styles.nearbyType}>{item.type}</span>
                    <span className={styles.nearbyName}>{item.name}</span>
                    {item.council && <span className={styles.nearbyCouncil}>· {item.council}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default TourismTravelerSection;
