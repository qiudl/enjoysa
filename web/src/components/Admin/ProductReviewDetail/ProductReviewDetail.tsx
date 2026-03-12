import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Image,
  MapPin,
  Clock,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import type { ProductReview, ProductReviewStatus, ProductCategory } from '../ProductReviewTable';
import styles from './ProductReviewDetail.module.css';

export interface ProductReviewDetailProps {
  product: ProductReview | null;
  open: boolean;
  onClose: () => void;
  onApprove?: (product: ProductReview) => void;
  onReject?: (product: ProductReview, reason: string) => void;
}

export const ProductReviewDetail: React.FC<ProductReviewDetailProps> = ({
  product,
  open,
  onClose,
  onApprove,
  onReject,
}) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'info' | 'images' | 'itinerary'>('info');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  // Mock images for demonstration
  const mockImages = [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
    'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800',
  ];

  if (!open || !product) return null;

  const getStatusLabel = (status: ProductReviewStatus) => {
    const labels: Record<ProductReviewStatus, string> = {
      pending: t('admin.products.status.pending'),
      approved: t('admin.products.status.approved'),
      rejected: t('admin.products.status.rejected'),
    };
    return labels[status];
  };

  const getCategoryLabel = (category: ProductCategory) => {
    const labels: Record<ProductCategory, string> = {
      day_tour: t('admin.products.categories.dayTour'),
      multi_day: t('admin.products.categories.multiDay'),
      activity: t('admin.products.categories.activity'),
      ticket: t('admin.products.categories.ticket'),
    };
    return labels[category];
  };

  const formatPrice = (price: number) => {
    return `A$${price.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleReject = () => {
    if (rejectReason.trim() && onReject) {
      onReject(product, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
    }
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : mockImages.length - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev < mockImages.length - 1 ? prev + 1 : 0));
  };

  const tabs = [
    { key: 'info', label: t('admin.products.detail.tabs.info') },
    { key: 'images', label: t('admin.products.detail.tabs.images') },
    { key: 'itinerary', label: t('admin.products.detail.tabs.itinerary') },
  ];

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('admin.products.detail.title')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.productHeader}>
          <div className={styles.productInfo}>
            {product.thumbnail ? (
              <img src={product.thumbnail} alt="" className={styles.thumbnail} />
            ) : (
              <div className={styles.thumbnailPlaceholder}>
                <Image size={32} />
              </div>
            )}
            <div className={styles.productMeta}>
              <h3 className={styles.productName}>{product.name}</h3>
              {product.nameEn && (
                <p className={styles.productNameEn}>{product.nameEn}</p>
              )}
              <div className={styles.tags}>
                <span className={styles.categoryTag}>{getCategoryLabel(product.category)}</span>
                <span className={clsx(styles.statusBadge, styles[product.status])}>
                  {getStatusLabel(product.status)}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.priceBox}>
            <span className={styles.priceLabel}>{t('admin.products.detail.price')}</span>
            <span className={styles.price}>{formatPrice(product.price)}</span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className={styles.originalPrice}>{formatPrice(product.originalPrice)}</span>
            )}
          </div>
        </div>

        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={clsx(styles.tab, activeTab === tab.key && styles.active)}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {activeTab === 'info' && (
            <div className={styles.infoSection}>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><User size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.products.detail.supplier')}</span>
                    <span className={styles.infoValue}>{product.supplierName}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Calendar size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.products.detail.submitDate')}</span>
                    <span className={styles.infoValue}>{formatDate(product.submittedAt)}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Clock size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.products.detail.duration')}</span>
                    <span className={styles.infoValue}>8 {t('admin.products.detail.hours')}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><MapPin size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.products.detail.location')}</span>
                    <span className={styles.infoValue}>Adelaide, SA</span>
                  </div>
                </div>
              </div>

              <div className={styles.descriptionSection}>
                <h4 className={styles.sectionTitle}>{t('admin.products.detail.description')}</h4>
                <p className={styles.description}>
                  {product.description || t('admin.products.detail.noDescription')}
                </p>
              </div>

              <div className={styles.includesSection}>
                <h4 className={styles.sectionTitle}>{t('admin.products.detail.includes')}</h4>
                <ul className={styles.includesList}>
                  <li>{t('admin.products.detail.includeItem1')}</li>
                  <li>{t('admin.products.detail.includeItem2')}</li>
                  <li>{t('admin.products.detail.includeItem3')}</li>
                </ul>
              </div>

              <div className={styles.excludesSection}>
                <h4 className={styles.sectionTitle}>{t('admin.products.detail.excludes')}</h4>
                <ul className={styles.excludesList}>
                  <li>{t('admin.products.detail.excludeItem1')}</li>
                  <li>{t('admin.products.detail.excludeItem2')}</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className={styles.imagesSection}>
              <div className={styles.imageGallery}>
                <img
                  src={mockImages[currentImageIndex]}
                  alt=""
                  className={styles.mainImage}
                />
                <button className={clsx(styles.navBtn, styles.prevBtn)} onClick={handlePrevImage}>
                  <ChevronLeft size={24} />
                </button>
                <button className={clsx(styles.navBtn, styles.nextBtn)} onClick={handleNextImage}>
                  <ChevronRight size={24} />
                </button>
                <div className={styles.imageCounter}>
                  {currentImageIndex + 1} / {mockImages.length}
                </div>
              </div>
              <div className={styles.thumbnails}>
                {mockImages.map((img, index) => (
                  <button
                    key={index}
                    className={clsx(styles.thumbnailBtn, index === currentImageIndex && styles.active)}
                    onClick={() => setCurrentImageIndex(index)}
                  >
                    <img src={img} alt="" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'itinerary' && (
            <div className={styles.itinerarySection}>
              <div className={styles.itineraryItem}>
                <div className={styles.timePoint}>
                  <span className={styles.time}>08:00</span>
                  <span className={styles.dot} />
                </div>
                <div className={styles.itineraryContent}>
                  <h5>{t('admin.products.detail.pickup')}</h5>
                  <p>{t('admin.products.detail.pickupDesc')}</p>
                </div>
              </div>
              <div className={styles.itineraryItem}>
                <div className={styles.timePoint}>
                  <span className={styles.time}>10:00</span>
                  <span className={styles.dot} />
                </div>
                <div className={styles.itineraryContent}>
                  <h5>{t('admin.products.detail.activity1')}</h5>
                  <p>{t('admin.products.detail.activity1Desc')}</p>
                </div>
              </div>
              <div className={styles.itineraryItem}>
                <div className={styles.timePoint}>
                  <span className={styles.time}>12:30</span>
                  <span className={styles.dot} />
                </div>
                <div className={styles.itineraryContent}>
                  <h5>{t('admin.products.detail.lunch')}</h5>
                  <p>{t('admin.products.detail.lunchDesc')}</p>
                </div>
              </div>
              <div className={styles.itineraryItem}>
                <div className={styles.timePoint}>
                  <span className={styles.time}>16:00</span>
                  <span className={styles.dot} />
                </div>
                <div className={styles.itineraryContent}>
                  <h5>{t('admin.products.detail.return')}</h5>
                  <p>{t('admin.products.detail.returnDesc')}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {product.status === 'pending' && (
            <>
              <button
                className={clsx(styles.btn, styles.btnReject)}
                onClick={() => setShowRejectModal(true)}
              >
                <XCircle size={16} />
                <span>{t('admin.products.actions.reject')}</span>
              </button>
              <button
                className={clsx(styles.btn, styles.btnApprove)}
                onClick={() => onApprove?.(product)}
              >
                <CheckCircle size={16} />
                <span>{t('admin.products.actions.approve')}</span>
              </button>
            </>
          )}
          {product.status === 'approved' && (
            <div className={styles.statusMessage}>
              <CheckCircle size={16} />
              <span>{t('admin.products.detail.approvedMessage')}</span>
            </div>
          )}
          {product.status === 'rejected' && (
            <div className={styles.statusMessage}>
              <XCircle size={16} />
              <span>{t('admin.products.detail.rejectedMessage')}</span>
              {product.reviewNote && (
                <p className={styles.reviewNote}>{product.reviewNote}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <>
          <div className={styles.modalOverlay} onClick={() => setShowRejectModal(false)} />
          <div className={styles.modal}>
            <h3>{t('admin.products.reject.title')}</h3>
            <p>{t('admin.products.reject.message')}</p>
            <textarea
              className={styles.textarea}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('admin.products.reject.placeholder')}
              rows={4}
            />
            <div className={styles.modalActions}>
              <button
                className={clsx(styles.btn, styles.btnSecondary)}
                onClick={() => setShowRejectModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className={clsx(styles.btn, styles.btnReject)}
                onClick={handleReject}
                disabled={!rejectReason.trim()}
              >
                {t('admin.products.actions.reject')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default ProductReviewDetail;
