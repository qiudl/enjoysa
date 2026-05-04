import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supplierBriefing, type SupplierBriefingResponse } from '../../../services/aiService';
import styles from './SupplierBriefing.module.css';

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
    <div className={styles.wrapper}>
      <div className={styles.title}>
        📊 {t('aiBriefing.title', '今日 AI 简报')}
        <span className={styles.badge}>AI</span>
      </div>
      {data.stats?.map((stat, i) => (
        <div key={i} className={styles.statRow}>
          <span>{stat.icon}</span>
          <span className={styles.statText}>{stat.text}</span>
          {stat.change && (
            <span
              className={styles.statChange}
              style={{ background: trendColors[stat.trend] || '#f4f5f7', color: trendTextColors[stat.trend] || '#555' }}
            >
              {stat.change}
            </span>
          )}
        </div>
      ))}
      {data.suggestion && (
        <div className={styles.suggestion}>
          💡 <strong>AI 建议：</strong>{data.suggestion}
        </div>
      )}
    </div>
  );
}
