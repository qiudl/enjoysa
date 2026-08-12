import React, { useState, useEffect } from 'react';
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
  Package,
  Star,
  HelpCircle,
} from 'lucide-react';
import clsx from 'clsx';
import type { ProductReview, ProductReviewStatus, ProductCategory } from '../ProductReviewTable';
import { adminService } from '../../../services/adminService';
import type { ApiProduct, ApiProductImage, ApiProductPackage, ApiProductHighlight, ApiProductFAQ } from '../../../services/productService';
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
  const [activeTab, setActiveTab] = useState<'info' | 'images' | 'details'>('info');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Full product data from API
  const [fullProduct, setFullProduct] = useState<ApiProduct | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  // Fetch full product details when drawer opens
  useEffect(() => {
    if (!open || !product) {
      setFullProduct(null);
      setCurrentImageIndex(0);
      setActiveTab('info');
      return;
    }
    (async () => {
      setLoadingDetail(true);
      try {
        // Admin review must use the authenticated endpoint: the public product
        // endpoint intentionally hides drafts, which previously left their
        // images, packages, highlights and FAQs blank in this drawer.
        const data = await adminService.getProduct(Number(product.id));
        setFullProduct(data);
      } catch {
        // fallback: no full data
      }
      setLoadingDetail(false);
    })();
  }, [open, product?.id]);

  if (!open || !product) return null;

  const images: ApiProductImage[] = fullProduct?.images || [];
  const packages: ApiProductPackage[] = fullProduct?.packages || [];
  const highlights: ApiProductHighlight[] = fullProduct?.highlights || [];
  const faqs: ApiProductFAQ[] = fullProduct?.faqs || [];

  const getStatusLabel = (status: ProductReviewStatus) => {
    const labels: Record<ProductReviewStatus, string> = {
      draft: t('admin.products.status.draft'),
      pending: t('admin.products.status.pending'),
      approved: t('admin.products.status.approved'),
      rejected: t('admin.products.status.rejected'),
      offline: t('admin.products.status.offline'),
    };
    return labels[status];
  };

  // REQ-20260509-0030: 同 ProductReviewTable.getCategoryLabel — 仅读后端
  // 真实分类对象，不再走死写枚举映射。fullProduct 是抓详情时拉到的完整记录，
  // category 字段在那里始终有完整 name_zh/name_en；list 行 product 也从
  // REQ-0030 开始携带同结构对象。
  const getCategoryLabel = (category?: ProductCategory) => {
    const candidate = fullProduct?.category ?? category;
    if (!candidate) return '—';
    const localized = isZh ? candidate.name_zh : candidate.name_en;
    return localized || candidate.name_en || candidate.name_zh || candidate.slug || '—';
  };

  const formatPrice = (price: number) => `A$${price.toFixed(2)}`;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
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
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const tabs = [
    { key: 'info', label: t('admin.products.detail.tabs.info') },
    { key: 'images', label: `${t('admin.products.detail.tabs.images')} (${images.length})` },
    { key: 'details', label: isZh ? '套餐与亮点' : 'Packages & More' },
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
          {loadingDetail && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              {t('common.loading')}
            </div>
          )}

          {activeTab === 'info' && (
            <div className={styles.infoSection}>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><User size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.products.detail.supplier')}</span>
                    <span className={styles.infoValue}>
                      {fullProduct?.supplier?.name || product.supplierName}
                    </span>
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
                    <span className={styles.infoValue}>
                      {fullProduct?.duration || '-'}
                    </span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><MapPin size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.products.detail.location')}</span>
                    <span className={styles.infoValue}>
                      {(isZh ? fullProduct?.address_zh : fullProduct?.address_en) || (isZh ? fullProduct?.region?.name_zh : fullProduct?.region?.name_en) || '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.descriptionSection}>
                <h4 className={styles.sectionTitle}>{t('admin.products.detail.description')}</h4>
                <p className={styles.description}>
                  {(isZh ? fullProduct?.description_zh : fullProduct?.description_en) || product.description || t('admin.products.detail.noDescription')}
                </p>
              </div>

              {/* Highlights as includes */}
              {highlights.length > 0 && (
                <div className={styles.includesSection}>
                  <h4 className={styles.sectionTitle}>
                    <Star size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                    {isZh ? '产品亮点' : 'Highlights'} ({highlights.length})
                  </h4>
                  <ul className={styles.includesList}>
                    {highlights.map((h) => (
                      <li key={h.id}>
                        <strong>{isZh ? h.title_zh : h.title_en}</strong>
                        {(isZh ? h.desc_zh : h.desc_en) && (
                          <> — {isZh ? h.desc_zh : h.desc_en}</>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* FAQs */}
              {faqs.length > 0 && (
                <div className={styles.excludesSection}>
                  <h4 className={styles.sectionTitle}>
                    <HelpCircle size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                    FAQ ({faqs.length})
                  </h4>
                  <div>
                    {faqs.map((f) => (
                      <div key={f.id} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                          Q: {isZh ? f.question_zh : f.question_en}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 2 }}>
                          A: {isZh ? f.answer_zh : f.answer_en}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'images' && (
            <div className={styles.imagesSection}>
              {images.length > 0 ? (
                <>
                  <div className={styles.imageGallery}>
                    <img
                      src={images[currentImageIndex]?.url}
                      alt=""
                      className={styles.mainImage}
                    />
                    {images.length > 1 && (
                      <>
                        <button className={clsx(styles.navBtn, styles.prevBtn)} onClick={handlePrevImage}>
                          <ChevronLeft size={24} />
                        </button>
                        <button className={clsx(styles.navBtn, styles.nextBtn)} onClick={handleNextImage}>
                          <ChevronRight size={24} />
                        </button>
                      </>
                    )}
                    <div className={styles.imageCounter}>
                      {currentImageIndex + 1} / {images.length}
                    </div>
                  </div>
                  <div className={styles.thumbnails}>
                    {images.map((img, index) => (
                      <button
                        key={img.id}
                        className={clsx(styles.thumbnailBtn, index === currentImageIndex && styles.active)}
                        onClick={() => setCurrentImageIndex(index)}
                      >
                        <img src={img.url} alt="" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  <Image size={48} style={{ marginBottom: '0.5rem' }} />
                  <p>{isZh ? '暂无产品图片' : 'No product images'}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div>
              {/* Packages */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 className={styles.sectionTitle}>
                  <Package size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                  {isZh ? '套餐价格' : 'Packages'} ({packages.length})
                </h4>
                {packages.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {packages.map((pkg) => (
                      <div key={pkg.id} style={{
                        background: '#f8fafc', borderRadius: '0.5rem', padding: '0.75rem 1rem',
                        border: '1px solid #e2e8f0',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                              {isZh ? pkg.name_zh : pkg.name_en}
                            </div>
                            {(isZh ? pkg.desc_zh : pkg.desc_en) && (
                              <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 2 }}>
                                {isZh ? pkg.desc_zh : pkg.desc_en}
                              </div>
                            )}
                          </div>
                          <span style={{ fontWeight: 700, color: '#059669', fontSize: '1rem', flexShrink: 0 }}>
                            A${pkg.price}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                    {isZh ? '暂无套餐' : 'No packages'}
                  </p>
                )}
              </div>

              {/* Highlights */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 className={styles.sectionTitle}>
                  <Star size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                  {isZh ? '产品亮点' : 'Highlights'} ({highlights.length})
                </h4>
                {highlights.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {highlights.map((h) => (
                      <div key={h.id} style={{
                        background: '#f0fdf4', borderRadius: '0.5rem', padding: '0.75rem 1rem',
                        border: '1px solid #dcfce7',
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#166534' }}>
                          {isZh ? h.title_zh : h.title_en}
                        </div>
                        {(isZh ? h.desc_zh : h.desc_en) && (
                          <div style={{ fontSize: '0.8125rem', color: '#4b5563', marginTop: 2 }}>
                            {isZh ? h.desc_zh : h.desc_en}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                    {isZh ? '暂无亮点' : 'No highlights'}
                  </p>
                )}
              </div>

              {/* FAQ */}
              <div>
                <h4 className={styles.sectionTitle}>
                  <HelpCircle size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                  FAQ ({faqs.length})
                </h4>
                {faqs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {faqs.map((f) => (
                      <div key={f.id} style={{
                        background: '#eff6ff', borderRadius: '0.5rem', padding: '0.75rem 1rem',
                        border: '1px solid #dbeafe',
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e40af' }}>
                          Q: {isZh ? f.question_zh : f.question_en}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#4b5563', marginTop: 4 }}>
                          A: {isZh ? f.answer_zh : f.answer_en}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                    {isZh ? '暂无常见问题' : 'No FAQ'}
                  </p>
                )}
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
