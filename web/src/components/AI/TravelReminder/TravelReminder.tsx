import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { travelReminder, type TravelReminderResponse } from '../../../services/aiService';

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
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        🌤️ {t('aiReminder.title', '出行提醒')}
        <span style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 8 }}>AI</span>
      </h3>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', fontSize: 14 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
          <div style={{ color: '#444', lineHeight: 1.5 }}><strong>{item.label}：</strong>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
