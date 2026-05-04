import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reviewSummary as fetchReviewSummary, type ReviewSummaryResponse } from '../../../services/aiService';
import styles from './ReviewSummary.module.css';

interface ReviewSummaryProps {
  productId: number;
  rating: number;
  reviewCount: number;
  language?: string;
}

export default function ReviewSummary({ productId, rating, reviewCount, language = 'zh' }: ReviewSummaryProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<ReviewSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (reviewCount < 3) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchReviewSummary(productId, language).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [productId, language, reviewCount]);

  if (reviewCount < 3) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>
        📊 {t('aiReview.title', '评价摘要')}
        <span className={styles.badge}>{t('aiReview.badge', `AI 总结 ${reviewCount} 条`)}</span>
      </div>

      <div className={styles.overall}>
        <div className={styles.score}>{rating.toFixed(1)}</div>
        <div>
          <div className={styles.stars}>{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</div>
          <div className={styles.count}>{reviewCount} {t('aiReview.reviews', '条评价')}</div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          {t('aiReview.loading', 'AI 正在分析评价...')}
        </div>
      ) : data ? (
        <>
          <div className={styles.keywords}>
            {data.positive_keywords.length > 0 && (
              <>
                <div className={styles.kwLabel}>👍 {t('aiReview.positive', '好评集中在')}</div>
                <div className={styles.kwRow}>
                  {data.positive_keywords.map((kw) => (
                    <span key={kw} className={`${styles.kwTag} ${styles.kwPos}`}>{kw}</span>
                  ))}
                </div>
              </>
            )}
            {data.negative_keywords.length > 0 && (
              <>
                <div className={styles.kwLabel}>⚠️ {t('aiReview.negative', '少数提到')}</div>
                <div className={styles.kwRow}>
                  {data.negative_keywords.map((kw) => (
                    <span key={kw} className={`${styles.kwTag} ${styles.kwNeg}`}>{kw}</span>
                  ))}
                </div>
              </>
            )}
            {data.best_for.length > 0 && (
              <>
                <div className={styles.kwLabel}>💡 {t('aiReview.bestFor', '最适合')}</div>
                <div className={styles.kwRow}>
                  {data.best_for.map((kw) => (
                    <span key={kw} className={`${styles.kwTag} ${styles.kwFit}`}>{kw}</span>
                  ))}
                </div>
              </>
            )}
          </div>
          {data.summary && (
            <div className={styles.aiNote}>
              <strong>AI {t('aiReview.summary', '总结')}：</strong>{data.summary}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
