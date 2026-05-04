import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reviewReply } from '../../../services/aiService';

interface ReviewReplyAiProps {
  reviewText: string;
  rating: number;
  productName: string;
  reviewId?: number;
  onUseReply: (reply: string) => void;
}

export default function ReviewReplyAi({ reviewText, rating, productName, reviewId, onUseReply }: ReviewReplyAiProps) {
  const { t } = useTranslation();
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setExpanded(true);
    const result = await reviewReply(reviewText, rating, productName, reviewId);
    setReply(result || t('aiReply.failed', '生成失败，请重试'));
    setLoading(false);
  };

  if (!expanded) {
    return (
      <button onClick={handleGenerate} style={{ background: 'none', border: '1px dashed #c8ddf8', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#667eea', cursor: 'pointer', marginTop: 8 }}>
        🤖 {t('aiReply.suggest', 'AI 建议回复')}
      </button>
    );
  }

  return (
    <div style={{ background: '#f8f9fb', border: '1px dashed #c8ddf8', borderRadius: 8, padding: 10, marginTop: 8, fontSize: 12 }}>
      <div style={{ color: '#667eea', fontWeight: 600, marginBottom: 4 }}>🤖 {t('aiReply.label', 'AI 建议回复')}</div>
      {loading ? (
        <div style={{ color: '#999' }}>{t('aiReply.generating', '正在生成...')}</div>
      ) : (
        <>
          <div style={{ color: '#555', lineHeight: 1.5 }}>{reply}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => onUseReply(reply)} style={{ background: '#667eea', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
              {t('aiReply.use', '采用')}
            </button>
            <button onClick={handleGenerate} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
              🔄
            </button>
          </div>
        </>
      )}
    </div>
  );
}
