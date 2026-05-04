import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { travelReminder, type TravelReminderResponse } from '../../../services/aiService';
import styles from './TravelReminder.module.css';

interface TravelReminderProps {
  orderId: number;
  productId?: number;
  bookingDate?: string;
  language?: string;
}

export default function TravelReminder({ orderId, productId, bookingDate, language = 'zh' }: TravelReminderProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<TravelReminderResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    travelReminder(orderId, productId, bookingDate, language).then(setData).finally(() => setLoading(false));
  }, [orderId]); // eslint-disable-line

  if (loading || !data) return null;

  const items = [
    { icon: '🌡️', label: t('aiReminder.weather', '天气'), value: data.weather },
    { icon: '👕', label: t('aiReminder.clothing', '建议穿着'), value: data.clothing },
    { icon: '📍', label: t('aiReminder.meetingPoint', '集合点'), value: data.meeting_point },
    { icon: '🎒', label: t('aiReminder.items', '建议携带'), value: data.items?.join('、') },
    { icon: '🌟', label: t('aiReminder.highlight', '今日亮点'), value: data.highlight },
  ].filter(i => i.value);

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>
        🌤️ {t('aiReminder.title', '出行提醒')}
        <span className={styles.badge}>AI</span>
      </h3>
      {items.map((item, i) => (
        <div key={i} className={styles.item}>
          <span className={styles.itemIcon}>{item.icon}</span>
          <div className={styles.itemText}><strong>{item.label}：</strong>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
