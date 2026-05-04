import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reviewReply } from '../../../services/aiService';
import styles from './ReviewReplyAi.module.css';

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
      <button onClick={handleGenerate} className={styles.triggerBtn}>
        🤖 {t('aiReply.suggest', 'AI 建议回复')}
      </button>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>🤖 {t('aiReply.label', 'AI 建议回复')}</div>
      {loading ? (
        <div className={styles.loading}>{t('aiReply.generating', '正在生成...')}</div>
      ) : (
        <>
          <div className={styles.replyText}>{reply}</div>
          <div className={styles.actions}>
            <button onClick={() => onUseReply(reply)} className={styles.useBtn}>
              {t('aiReply.use', '采用')}
            </button>
            <button onClick={handleGenerate} className={styles.retryBtn}>
              🔄
            </button>
          </div>
        </>
      )}
    </div>
  );
}
