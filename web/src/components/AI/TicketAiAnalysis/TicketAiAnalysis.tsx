import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ticketAnalysis, type TicketAnalysisResponse } from '../../../services/aiService';

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

  if (loading) return <div style={{ padding: 12, color: '#999', fontSize: 13 }}>🤖 {t('aiTicket.analyzing', 'AI 正在分析...')}</div>;
  if (!data) return null;

  return (
    <div style={{ border: '1px solid #e0e8f5', borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span>🤖</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{t('aiTicket.title', 'AI 分析')}</span>
        <span style={{ background: '#f0f0ff', color: '#667eea', fontSize: 12, padding: '4px 10px', borderRadius: 8, fontWeight: 600 }}>{data.intent}</span>
      </div>
      {data.context && Object.keys(data.context).length > 0 && (
        <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
          {Object.entries(data.context).map(([k, v]) => <div key={k}>✓ {k}：{v}</div>)}
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>{t('aiTicket.solutions', '建议处理方案')}：</div>
      {data.solutions?.map((sol, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < data.solutions.length - 1 ? '1px solid #f0f0f0' : 'none', fontSize: 13 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: '#f0f0ff', color: '#667eea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
          <div style={{ color: '#444', lineHeight: 1.4, flex: 1 }}>
            <strong>{sol.label}</strong> — {sol.detail}
            {sol.recommended && <span style={{ fontSize: 11, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>💡 {t('aiTicket.recommended', '推荐')}</span>}
          </div>
        </div>
      ))}
      {onUseSolution && data.solutions?.find(s => s.recommended) && (
        <button
          onClick={() => onUseSolution(data.solutions.find(s => s.recommended)!.detail)}
          style={{ display: 'block', width: '100%', padding: 8, marginTop: 10, background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', textAlign: 'center' }}
        >
          {t('aiTicket.useSolution', '采用推荐方案并回复')}
        </button>
      )}
    </div>
  );
}
