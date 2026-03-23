import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Send } from 'lucide-react';
import styles from './SupplierReviewsPage.module.css';

export interface SupplierReviewsPageProps {
  onNavigate?: (path: string) => void;
}

interface Review {
  id: string;
  customerName: string;
  rating: number;
  content: string;
  productName: string;
  productNameEn: string;
  date: string;
  reply?: string;
}

const mockReviews: Review[] = [
  {
    id: 'r1',
    customerName: 'Alice Wang',
    rating: 5,
    content: 'Wonderful experience! The kangaroo island tour was amazing and the guide was very knowledgeable.',
    productName: '袋鼠岛一日游',
    productNameEn: 'Kangaroo Island Day Tour',
    date: '2026-03-20',
    reply: 'Thank you for your kind words! We are glad you enjoyed the tour.',
  },
  {
    id: 'r2',
    customerName: 'Bob Zhang',
    rating: 4,
    content: 'Great wine tasting tour. The Barossa Valley is beautiful. Would recommend adding more wineries.',
    productName: '巴罗萨谷品酒之旅',
    productNameEn: 'Barossa Valley Wine Tour',
    date: '2026-03-18',
  },
  {
    id: 'r3',
    customerName: 'Carol Li',
    rating: 3,
    content: 'The tour was okay but the bus was a bit cramped. Food was decent though.',
    productName: '阿德莱德城市观光',
    productNameEn: 'Adelaide City Sightseeing',
    date: '2026-03-15',
  },
  {
    id: 'r4',
    customerName: 'David Chen',
    rating: 5,
    content: 'Best wildlife experience ever! Got to hold a koala and feed kangaroos.',
    productName: '克莱兰德野生动物园',
    productNameEn: 'Cleland Wildlife Park Tour',
    date: '2026-03-12',
    reply: 'So happy you had a wonderful time with the wildlife!',
  },
  {
    id: 'r5',
    customerName: 'Eva Liu',
    rating: 2,
    content: 'Tour was cancelled due to weather but the refund process took too long.',
    productName: '维克多港企鹅观赏',
    productNameEn: 'Victor Harbor Penguin Tour',
    date: '2026-03-10',
  },
  {
    id: 'r6',
    customerName: 'Frank Ma',
    rating: 4,
    content: 'Enjoyed the sunset tour at Glenelg beach. Very romantic setting.',
    productName: '格雷内尔格日落之旅',
    productNameEn: 'Glenelg Sunset Tour',
    date: '2026-03-08',
  },
];

export const SupplierReviewsPage: React.FC<SupplierReviewsPageProps> = () => {
  const { t, i18n } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>(mockReviews);
  const [filter, setFilter] = useState<'all' | 'pending' | 'replied'>('all');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const filteredReviews = reviews.filter((r) => {
    if (filter === 'pending') return !r.reply;
    if (filter === 'replied') return !!r.reply;
    return true;
  });

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
    : '0.0';
  const repliedCount = reviews.filter((r) => r.reply).length;
  const replyRate = totalReviews > 0
    ? Math.round((repliedCount / totalReviews) * 100)
    : 0;

  const handleReply = (reviewId: string) => {
    if (!replyText.trim()) return;
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, reply: replyText } : r))
    );
    setReplyText('');
    setReplyingId(null);
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
          <div className={styles.statStars}>{renderStars(Math.round(Number(avgRating)))}</div>
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
      {filteredReviews.length > 0 ? (
        <div className={styles.reviewList}>
          {filteredReviews.map((review) => (
            <div key={review.id} className={styles.reviewCard}>
              <div className={styles.reviewHeader}>
                <div className={styles.reviewCustomer}>
                  <div className={styles.customerAvatar}>
                    {review.customerName.charAt(0)}
                  </div>
                  <div>
                    <span className={styles.customerName}>{review.customerName}</span>
                    <span className={styles.reviewDate}>{review.date}</span>
                  </div>
                </div>
                <div className={styles.reviewRating}>
                  {renderStars(review.rating)}
                </div>
              </div>

              <div className={styles.reviewProduct}>
                {i18n.language === 'en' ? review.productNameEn : review.productName}
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
                      disabled={!replyText.trim()}
                    >
                      <Send size={14} />
                      {t('supplier.reviews.submitReply')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
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
