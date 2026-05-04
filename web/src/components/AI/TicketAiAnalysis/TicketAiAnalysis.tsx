import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ticketAnalysis, type TicketAnalysisResponse } from '../../../services/aiService';
import styles from './TicketAiAnalysis.module.css';

interface TicketAiAnalysisProps {
  message: string;
  orderInfo?: string;
  ticketId?: number;
  onUseSolution?: (solution: string) => void;
}

export default function TicketAiAnalysis({ message, orderInfo, ticketId, onUseSolution }: TicketAiAnalysisProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<TicketAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ticketAnalysis(message, orderInfo, ticketId).then(setData).finally(() => setLoading(false));
  }, [ticketId]); // eslint-disable-line

  if (loading) return <div className={styles.loading}>🤖 {t('aiTicket.analyzing', 'AI 正在分析...')}</div>;
  if (!data) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span>🤖</span>
        <span className={styles.headerTitle}>{t('aiTicket.title', 'AI 分析')}</span>
        <span className={styles.intentBadge}>{data.intent}</span>
      </div>
      {data.context && Object.keys(data.context).length > 0 && (
        <div className={styles.contextInfo}>
          {Object.entries(data.context).map(([k, v]) => <div key={k}>✓ {k}：{v}</div>)}
        </div>
      )}
      <div className={styles.solutionsTitle}>{t('aiTicket.solutions', '建议处理方案')}：</div>
      {data.solutions?.map((sol, i) => (
        <div key={i} className={i < data.solutions.length - 1 ? styles.solutionRowBorder : styles.solutionRow}>
          <div className={styles.solutionNum}>{i + 1}</div>
          <div className={styles.solutionBody}>
            <strong>{sol.label}</strong> — {sol.detail}
            {sol.recommended && <span className={styles.recommendedTag}>💡 {t('aiTicket.recommended', '推荐')}</span>}
          </div>
        </div>
      ))}
      {onUseSolution && data.solutions?.find(s => s.recommended) && (
        <button
          onClick={() => onUseSolution(data.solutions.find(s => s.recommended)!.detail)}
          className={styles.useBtn}
        >
          {t('aiTicket.useSolution', '采用推荐方案并回复')}
        </button>
      )}
    </div>
  );
}
