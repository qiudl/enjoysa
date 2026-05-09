import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Edit,
  Info,
  Image,
  ChevronLeft,
  ChevronRight,
  Star,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { supplierProductService } from '../../../services/supplierProductService';
import { productService } from '../../../services/productService';
import type { ApiProduct, ApiProductSchedule } from '../../../services/productService';
import styles from './SupplierProductPreviewPage.module.css';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface SupplierProductPreviewPageProps {
  productId?: string;
  onNavigate?: (path: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const SupplierProductPreviewPage: React.FC<SupplierProductPreviewPageProps> = ({
  productId,
  onNavigate,
}) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  /* Data state */
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [schedules, setSchedules] = useState<ApiProductSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) { setLoading(false); return; }
    const id = Number(productId);
    if (!id) { setLoading(false); return; }

    setLoading(true);
    Promise.all([
      supplierProductService.getById(id),
      productService.getSchedules(id).catch(() => [] as ApiProductSchedule[]),
    ]).then(([prod, sched]) => {
      setProduct(prod);
      setSchedules(sched);
    }).catch(() => {
      // product not found
    }).finally(() => setLoading(false));
  }, [productId]);

  /* Carousel state */
  const [currentImage, setCurrentImage] = useState(0);
  const images = product?.images?.map((img) => img.url) || [];
  const imageCount = images.length || 1;

  const prevImage = () =>
    setCurrentImage((prev) => (prev - 1 + imageCount) % imageCount);
  const nextImage = () =>
    setCurrentImage((prev) => (prev + 1) % imageCount);

  /* Date selector state */
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  /* Available dates from schedules */
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    schedules.forEach((s) => {
      if (s.status === 'active' || s.status === 'available') {
        dates.add(s.date.slice(0, 10));
      }
    });
    // If no schedules, show next 7 days as placeholder
    if (dates.size === 0) {
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.add(d.toISOString().slice(0, 10));
      }
    }
    return Array.from(dates).sort();
  }, [schedules]);

  /* Localized helpers */
  const productName = product ? (isEn ? product.name_en : product.name_zh) : '';
  const description = product ? (isEn ? (product.description_en || product.summary_en) : (product.description_zh || product.summary_zh)) : '';
  const highlights = product?.highlights?.map((h) => isEn ? h.title_en : h.title_zh) || [];
  const duration = product?.duration || '';

  /* Format date for display */
  const formatDate = useMemo(() => {
    return (dateStr: string) => {
      const d = new Date(dateStr);
      const weekdays = isEn
        ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        : ['日', '一', '二', '三', '四', '五', '六'];
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const weekday = weekdays[d.getDay()];
      return { month, day, weekday };
    };
  }, [isEn]);

  /* Stars rendering */
  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.3;
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={18}
        fill={i < full || (i === full && hasHalf) ? '#f59e0b' : 'none'}
        stroke={i < full || (i === full && hasHalf) ? '#f59e0b' : '#d1d5db'}
      />
    ));
  };

  /* Loading state */
  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6rem 0' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

  /* Not found state */
  if (!product) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            className={styles.backBtn}
            onClick={() => onNavigate?.('/supplier/products')}
          >
            <ArrowLeft size={18} />
            <span>{t('common.back')}</span>
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
          {t('common.notFound', 'Product not found')}
        </div>
      </div>
    );
  }

  const rating = product.rating || 0;
  const reviewCount = product.review_count || 0;
  const price = product.price_from || product.packages?.[0]?.price || 0;
  const currency = product.currency || 'AUD';

  return (
    <div className={styles.container}>
      {/* Preview Banner */}
      <div className={styles.previewBanner}>
        <Info size={18} />
        <span>
          {t('supplier.preview.title')} ({t('supplier.preview.customerView')})
        </span>
      </div>

      {/*
        REQ-20260509-0019: Created-by-admin attribution. Renders only when the
        platform created this product on the supplier's behalf, so the supplier
        knows who acted as their proxy and when. Quietly absent for self-served
        products (created_via=supplier_self) — no need to clutter the page.
      */}
      {product.created_via === 'admin_proxy' && (
        <div className={styles.previewBanner} style={{ background: '#fff7e6', borderColor: '#ffd591', color: '#874d00' }}>
          <Info size={18} />
          <span>
            {t('supplier.product.proxyCreatedBy', {
              defaultValue: 'Created on your behalf by {{name}} on {{date}}',
              name: product.created_by_admin_name || t('supplier.product.formerAdmin', { defaultValue: 'a former admin' }),
              date: new Date(product.created_at).toLocaleDateString(),
            })}
          </span>
        </div>
      )}

      {/* Header: back + edit */}
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => onNavigate?.('/supplier/products')}
        >
          <ArrowLeft size={18} />
          <span>{t('common.back')}</span>
        </button>
        <button
          className={styles.editBtn}
          onClick={() => onNavigate?.(`/supplier/products/${productId}/edit`)}
        >
          <Edit size={16} />
          <span>{t('supplier.preview.editProduct')}</span>
        </button>
      </div>

      {/* Image Carousel */}
      <div className={styles.carousel}>
        <div className={styles.carouselMain}>
          {images.length > 0 ? (
            <img
              src={images[currentImage]}
              alt={productName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <>
              <Image size={48} strokeWidth={1.2} />
              <span className={styles.carouselPlaceholderText}>
                {t('supplier.preview.imagePlaceholder')}
              </span>
            </>
          )}
          {imageCount > 1 && (
            <>
              <button
                className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`}
                onClick={prevImage}
                aria-label="Previous image"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                className={`${styles.carouselArrow} ${styles.carouselArrowRight}`}
                onClick={nextImage}
                aria-label="Next image"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className={styles.thumbnails}>
            {images.map((url, idx) => (
              <button
                key={idx}
                className={`${styles.thumbnail} ${idx === currentImage ? styles.thumbnailActive : ''}`}
                onClick={() => setCurrentImage(idx)}
                aria-label={`Image ${idx + 1}`}
              >
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className={styles.productInfo}>
        <h1 className={styles.productName}>{productName}</h1>
        <div className={styles.rating}>
          {renderStars(rating)}
          <span className={styles.ratingValue}>{rating > 0 ? rating.toFixed(1) : '-'}</span>
          <span className={styles.reviewCount}>
            ({reviewCount} {t('supplier.preview.rating')})
          </span>
        </div>
        <div className={styles.priceRow}>
          <span className={styles.price}>
            {currency} ${price}
          </span>
          <span className={styles.perPerson}>/ {t('supplier.preview.perPerson')}</span>
        </div>
        {duration && (
          <span className={styles.durationBadge}>
            <Clock size={14} />
            {duration}
          </span>
        )}
      </div>

      {/* Date Selector */}
      {availableDates.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('supplier.preview.selectDate')}</h2>
          <div className={styles.dateSelector}>
            {availableDates.slice(0, 14).map((dateStr) => {
              const { month, day, weekday } = formatDate(dateStr);
              const isActive = selectedDate === dateStr;
              return (
                <button
                  key={dateStr}
                  className={`${styles.dateBtn} ${isActive ? styles.dateBtnActive : ''}`}
                  onClick={() => setSelectedDate(dateStr)}
                >
                  <span className={styles.dateWeekday}>{weekday}</span>
                  <span className={styles.dateDay}>{day}</span>
                  <span className={styles.dateMonth}>{month}{isEn ? '' : '月'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('supplier.preview.highlights')}</h2>
          <ul className={styles.highlightList}>
            {highlights.map((item, idx) => (
              <li key={idx} className={styles.highlightItem}>
                <Star size={16} fill="#f59e0b" stroke="#f59e0b" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Description */}
      {description && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('supplier.preview.description')}</h2>
          <p className={styles.descriptionText}>{description}</p>
        </div>
      )}

      {/* Packages */}
      {product.packages && product.packages.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('supplier.preview.includes')}</h2>
          <ul className={styles.checkList}>
            {product.packages.map((pkg) => (
              <li key={pkg.id} className={styles.includeItem}>
                <CheckCircle size={18} />
                <span>
                  {isEn ? pkg.name_en : pkg.name_zh} — {currency} ${pkg.price}
                  {(isEn ? pkg.desc_en : pkg.desc_zh) && ` (${isEn ? pkg.desc_en : pkg.desc_zh})`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* FAQs */}
      {product.faqs && product.faqs.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('supplier.preview.notices')}</h2>
          <ul className={styles.noticeList}>
            {product.faqs.map((faq) => (
              <li key={faq.id} className={styles.noticeItem}>
                <AlertTriangle size={18} />
                <span>
                  <strong>{isEn ? faq.question_en : faq.question_zh}</strong>{' '}
                  {isEn ? faq.answer_en : faq.answer_zh}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SupplierProductPreviewPage;
