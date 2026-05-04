import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminInsights, type AdminInsightsResponse } from '../../../services/aiService';

export default function AdminInsights() {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminInsights().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        🤖 {t('aiInsights.title', `${data.period}平台洞察`)}
        <span style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 8 }}>AI</span>
      </div>
      {data.insights?.map((insight, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, color: '#444' }}>
          <span>📊</span>
          <span>{insight}</span>
        </div>
      ))}
      {data.alerts?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {data.alerts.map((alert, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, color: '#dc2626' }}>
              <span>⚠️</span>
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
