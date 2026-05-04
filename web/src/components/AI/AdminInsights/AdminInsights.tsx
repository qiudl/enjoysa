import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminInsights, type AdminInsightsResponse } from '../../../services/aiService';
import styles from './AdminInsights.module.css';

export default function AdminInsights() {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminInsights().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>
        🤖 {t('aiInsights.title', `${data.period}平台洞察`)}
        <span className={styles.badge}>AI</span>
      </div>
      {data.insights?.map((insight, i) => (
        <div key={i} className={styles.insightRow}>
          <span>📊</span>
          <span>{insight}</span>
        </div>
      ))}
      {data.alerts?.length > 0 && (
        <div className={styles.alertSection}>
          {data.alerts.map((alert, i) => (
            <div key={i} className={styles.alertRow}>
              <span>⚠️</span>
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
