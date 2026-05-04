import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cartSuggestions, type CartSuggestionsResponse } from '../../../services/aiService';
import styles from './CartSuggestions.module.css';

interface CartSuggestionsProps {
  items: { product_id: number; date?: string }[];
  language?: string;
  onAddProduct?: (productId: number) => void;
}

export default function CartSuggestions({ items, language = 'zh', onAddProduct }: CartSuggestionsProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<CartSuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (items.length === 0) return;
    setLoading(true);
    cartSuggestions(items, language).then(setData).finally(() => setLoading(false));
  }, [items.length]); // eslint-disable-line

  if (loading) return <div className={styles.loading}>💡 {t('aiCart.loading', 'AI 正在分析搭配建议...')}</div>;
  if (!data) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span>💡</span>
        <strong className={styles.title}>{t('aiCart.title', 'AI 行程建议')}</strong>
        <span className={styles.badge}>智能分析</span>
      </div>
      {data.schedule_analysis && (
        <div className={styles.scheduleBox}>
          🗓️ {data.schedule_analysis}
        </div>
      )}
      {data.recommendations?.map((rec) => (
        <div key={rec.product_id} className={styles.recCard}>
          <div className={styles.recInfo}>
            <div className={styles.recName}>{rec.name}</div>
            <div className={styles.recReason}>{rec.reason}</div>
          </div>
          <div className={styles.recPrice}>A${rec.price}</div>
          <button
            onClick={() => onAddProduct?.(rec.product_id)}
            className={styles.addBtn}
          >+ {t('aiCart.add', '加入')}</button>
        </div>
      ))}
    </div>
  );
}
