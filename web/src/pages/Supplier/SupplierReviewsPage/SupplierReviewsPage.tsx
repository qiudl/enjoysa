import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Send, Loader2 } from 'lucide-react';
import { supplierReviewService, type ApiReview, type ReviewStats } from '../../../services/supplierReviewService';
import styles from './SupplierReviewsPage.module.css';

export interface SupplierReviewsPageProps {
  onNavigate?: (path: string) => void;
}

export const SupplierReviewsPage: React.FC<SupplierReviewsPageProps> = () => {
  const { t, i18n } = useTranslation();
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'replied'>('all');
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (filter === 'pending') params.has_reply = 'false';
      if (filter === 'replied') params.has_reply = 'true';

      const data = await supplierReviewService.list(params);
      setReviews(data.items || []);
      setTotalPages(data.total_pages);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await supplierReviewService.getStats();
      setStats(data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const handleReply = async (reviewId: number) => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await supplierReviewService.reply(reviewId, replyText);
      setReplyText('');
      setReplyingId(null);
      fetchReviews();
      fetchStats();
    } catch {
      // silently fail
    } finally {
      setReplying(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        fill={i < rating ? '#f59e0b' : 'none'}
        stroke={i < rating ? '#f59e0b' : '#d1d5db'}
      />
    ));
  };

  const filters = [
    { key: 'all' as const, label: t('supplier.reviews.all') },
    { key: 'pending' as const, label: t('supplier.reviews.pendingReply') },
    { key: 'replied' as const, label: t('supplier.reviews.replied') },
  ];

  const avgRating = stats ? stats.avg_rating.toFixed(1) : '-';
  const totalReviews = stats?.total_reviews ?? 0;
  const replyRate = stats ? Math.round(stats.reply_rate) : 0;

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('supplier.reviews.title')}</h1>
      </div>

      {/* Stats Section */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{avgRating}</span>
          <span className={styles.statLabel}>{t('supplier.reviews.avgRating')}</span>
          {totalReviews > 0 && (
            <div className={styles.statStars}>{renderStars(Math.round(Number(avgRating)))}</div>
          )}
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalReviews}</span>
          <span className={styles.statLabel}>{t('supplier.reviews.totalReviews')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{replyRate}%</span>
          <span className={styles.statLabel}>{t('supplier.reviews.replyRate')}</span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {filters.map((f) => (
            <button
              key={f.key}
              className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Review List */}
      {loading ? (
        <div className={styles.emptyState}>
          <Loader2 size={32} className={styles.spinner} />
        </div>
      ) : reviews.length > 0 ? (
        <>
          <div className={styles.reviewList}>
            {reviews.map((review) => (
              <div key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  <div className={styles.reviewCustomer}>
                    <div className={styles.customerAvatar}>
                      {(review.user?.name || 'U').charAt(0)}
                    </div>
                    <div>
                      <span className={styles.customerName}>{review.user?.name || 'User'}</span>
                      <span className={styles.reviewDate}>
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className={styles.reviewRating}>
                    {renderStars(review.rating)}
                  </div>
                </div>

                <div className={styles.reviewProduct}>
                  {i18n.language.startsWith('en')
                    ? review.product?.name_en
                    : review.product?.name_zh}
                </div>

                <p className={styles.reviewContent}>{review.content}</p>

                {/* Existing Reply */}
                {review.reply && (
                  <div className={styles.replySection}>
                    <span className={styles.replyLabel}>{t('supplier.reviews.supplierReply')}</span>
                    <p className={styles.replyContent}>{review.reply}</p>
                  </div>
                )}

                {/* Reply Button / Textarea */}
                {!review.reply && replyingId !== review.id && (
                  <button
                    className={styles.replyBtn}
                    onClick={() => {
                      setReplyingId(review.id);
                      setReplyText('');
                    }}
                  >
                    {t('supplier.reviews.reply')}
                  </button>
                )}

                {replyingId === review.id && (
                  <div className={styles.replyForm}>
                    <textarea
                      className={styles.replyTextarea}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={t('supplier.reviews.replyPlaceholder')}
                      rows={3}
                    />
                    <div className={styles.replyActions}>
                      <button
                        className={styles.replyCancelBtn}
                        onClick={() => {
                          setReplyingId(null);
                          setReplyText('');
                        }}
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        className={styles.replySubmitBtn}
                        onClick={() => handleReply(review.id)}
                        disabled={!replyText.trim() || replying}
                      >
                        {replying ? <Loader2 size={14} className={styles.spinner} /> : <Send size={14} />}
                        {t('supplier.reviews.submitReply')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                {t('common.prev', 'Prev')}
              </button>
              <span style={{ padding: '6px 12px', color: '#6b7280' }}>{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
              >
                {t('common.next', 'Next')}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>💬</span>
          <p className={styles.emptyText}>{t('supplier.reviews.noReviews')}</p>
        </div>
      )}
    </div>
  );
};

export default SupplierReviewsPage;
