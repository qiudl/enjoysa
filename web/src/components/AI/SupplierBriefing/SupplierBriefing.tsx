import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supplierBriefing, type SupplierBriefingResponse } from '../../../services/aiService';

export default function SupplierBriefing() {
  const { t } = useTranslation();
  const [data, setData] = useState<SupplierBriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supplierBriefing().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  const trendColors: Record<string, string> = { up: '#ecfdf5', down: '#fef2f2', warn: '#fff8e1' };
  const trendTextColors: Record<string, string> = { up: '#059669', down: '#dc2626', warn: '#f57f17' };

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        📊 {t('aiBriefing.title', '今日 AI 简报')}
        <span style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 8 }}>AI</span>
      </div>
      {data.stats?.map((stat, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 14 }}>
          <span>{stat.icon}</span>
          <span style={{ color: '#444' }}>{stat.text}</span>
          {stat.change && (
            <span style={{ background: trendColors[stat.trend] || '#f4f5f7', color: trendTextColors[stat.trend] || '#555', fontSize: 12, padding: '2px 8px', borderRadius: 8 }}>
              {stat.change}
            </span>
          )}
        </div>
      ))}
      {data.suggestion && (
        <div style={{ background: '#f0f7ff', borderRadius: 8, padding: 10, marginTop: 10, fontSize: 12, color: '#667eea', lineHeight: 1.5 }}>
          💡 <strong>AI 建议：</strong>{data.suggestion}
        </div>
      )}
    </div>
  );
}
