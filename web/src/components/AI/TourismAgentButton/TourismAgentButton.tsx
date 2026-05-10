// REQ-20260510-0002 · Phase 1 · 1F
//
// Embedded "✨ AI 生成 (南澳知识库)" button. Sits next to a product-form
// field; on click hits the tourism agent endpoint, waits for the response,
// and applies the generated content to the field via onApply. The button
// also surfaces the knowledge_refs count returned by the agent so the
// supplier can see "this was grounded in 4 KB entries" rather than
// trusting the LLM at face value.
//
// The dedicated 1/s burst-3 server-side limiter on /api/v1/ai/tourism/*
// means a chatty supplier hammering the button gets rate-limited cleanly;
// we surface that as a friendly toast rather than a generic error.

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2 } from 'lucide-react';
import {
  tourismAgentService,
  type TourismGenerateField,
  type TourismGenerateSkeleton,
  type TourismKnowledgeRef,
} from '../../../services/tourismAgentService';
import styles from './TourismAgentButton.module.css';

export interface TourismAgentButtonProps {
  field: TourismGenerateField;
  /** Editor role — supplier (default) or admin. Determines which auth token gets used. */
  role: 'supplier' | 'admin';
  /** Free-text language override. Defaults to zh-CN on the server. */
  language?: 'zh-CN' | 'en-US';
  /** Form-derived seed: council / category / duration / highlights / tags. Optional. */
  skeleton?: TourismGenerateSkeleton;
  /** Disable when the seed is incomplete enough that generation would be empty (eg no council). */
  disabled?: boolean;
  /** Called with generated content + refs. Caller is responsible for setting auto_generated_zh. */
  onApply: (content: string, refs: TourismKnowledgeRef[]) => void;
}

export const TourismAgentButton: React.FC<TourismAgentButtonProps> = ({
  field,
  role,
  language,
  skeleton,
  disabled,
  onApply,
}) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [refsCount, setRefsCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await tourismAgentService.generateContent(
        { field, language, skeleton },
        role,
      );
      onApply(resp.content, resp.knowledge_refs);
      setRefsCount(resp.knowledge_refs.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI generation failed');
      setRefsCount(null);
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
        disabled={disabled || busy}
        title={
          disabled
            ? t('tourismAgent.disabledHint', '请先填写区域 (Council) 和品类后再用 AI 生成')
            : t('tourismAgent.tooltip', '基于南澳旅游知识库生成')
        }
      >
        {busy ? <Loader2 size={14} className={styles.spin} /> : <Sparkles size={14} />}
        <span>
          {busy
            ? t('tourismAgent.busy', '生成中...')
            : t('tourismAgent.button', '✨ AI 生成')}
        </span>
      </button>
      {refsCount !== null && !busy && (
        <span className={styles.refs} title={t('tourismAgent.refsTooltip', '本次生成引用了多少条知识库条目')}>
          {t('tourismAgent.refsCount', '基于 {{n}} 条知识', { n: refsCount })}
        </span>
      )}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export default TourismAgentButton;
