import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cartSuggestions, type CartSuggestionsResponse } from '../../../services/aiService';

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

  if (loading) return <div style={{ padding: 16, color: '#999', fontSize: 14 }}>💡 {t('aiCart.loading', 'AI 正在分析搭配建议...')}</div>;
  if (!data) return null;

  return (
    <div style={{ background: 'linear-gradient(135deg,#f0f7ff,#e8f0fe)', border: '1px solid #c8ddf8', borderRadius: 14, padding: '16px 20px', margin: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span>💡</span>
        <strong style={{ fontSize: 15 }}>{t('aiCart.title', 'AI 行程建议')}</strong>
        <span style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 8 }}>智能分析</span>
      </div>
      {data.schedule_analysis && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13, color: '#444', lineHeight: 1.5 }}>
          🗓️ {data.schedule_analysis}
        </div>
      )}
      {data.recommendations?.map((rec) => (
        <div key={rec.product_id} style={{ display: 'flex', gap: 12, background: '#fff', border: '1px solid #e0e8f5', borderRadius: 10, padding: 12, marginBottom: 8, cursor: 'pointer', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 2 }}>{rec.name}</div>
            <div style={{ fontSize: 12, color: '#667eea' }}>{rec.reason}</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e74c3c', whiteSpace: 'nowrap' }}>A${rec.price}</div>
          <button
            onClick={() => onAddProduct?.(rec.product_id)}
            style={{ fontSize: 12, color: '#667eea', background: '#f0f0ff', border: '1px solid #667eea', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >+ {t('aiCart.add', '加入')}</button>
        </div>
      ))}
    </div>
  );
}
