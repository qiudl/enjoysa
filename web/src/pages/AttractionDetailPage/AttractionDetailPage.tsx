import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Star,
  Clock,
  MapPin,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Header, Footer } from '../../components/Common';
import { productService } from '../../services/productService';
import type {
  ApiProduct,
  ApiProductHighlight,
  ApiProductPackage,
  ApiProductFAQ,
} from '../../services/productService';
import styles from './AttractionDetailPage.module.css';

export interface AttractionDetailPageProps {
  attractionId?: string;
  cartCount?: number;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onSearch?: (keyword: string) => void;
  onBack?: () => void;
  onRegionClick?: (regionId: string) => void;
}

const tagLabels: Record<string, { zh: string; en: string }> = {
  instant_confirmation: { zh: '即时确认', en: 'Instant Confirm' },
  free_cancellation: { zh: '免费取消', en: 'Free Cancel' },
  wechat_pay: { zh: '微信支付', en: 'WeChat Pay' },
  chinese_guide: { zh: '中文导游', en: 'Chinese Guide' },
  family_friendly: { zh: '亲子推荐', en: 'Family Friendly' },
  photo_spot: { zh: '拍照打卡', en: 'Photo Spot' },
  seasonal: { zh: '季节限定', en: 'Seasonal' },
  bestseller: { zh: '畅销', en: 'Bestseller' },
};

function parseTags(tags: string | string[] | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const AttractionDetailPage: React.FC<AttractionDetailPageProps> = ({
  attractionId,
  cartCount = 0,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onSearch,
  onBack,
  onRegionClick,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');

  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    if (!attractionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    productService
      .getById(Number(attractionId))
      .then((data) => setProduct(data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [attractionId]);

  if (loading) {
    return (
      <div className={styles.page}>
        <Header
          cartCount={cartCount}
          onLoginClick={onLoginClick}
          onRegisterClick={onRegisterClick}
          onNavClick={onNavClick}
          onSearch={onSearch}
        />
        <div className={styles.loading}>{t('common.loading')}</div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className={styles.page}>
        <Header
          cartCount={cartCount}
          onLoginClick={onLoginClick}
          onRegisterClick={onRegisterClick}
          onNavClick={onNavClick}
          onSearch={onSearch}
        />
        <div className={styles.notFound}>
          <h2>{t('error.notFound')}</h2>
          <button onClick={onBack}>{t('common.back')}</button>
        </div>
        <Footer />
      </div>
    );
  }

  const images = product.images?.map((img) => img.url) || [];
  const highlights = product.highlights || [];
  const packages = product.packages || [];
  const faqs = product.faqs || [];
  const tags = parseTags(product.tags);
  const region = product.region;
  const supplier = product.supplier;

  const goNextImage = () => {
    if (images.length > 0) setCurrentImage((currentImage + 1) % images.length);
  };
  const goPrevImage = () => {
    if (images.length > 0) setCurrentImage((currentImage - 1 + images.length) % images.length);
  };

  return (
    <div className={styles.page}>
      <Header
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
        onSearch={onSearch}
      />

      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <button onClick={onBack}>{t('nav.home')}</button>
        <span>/</span>
        {region && (
          <>
            <button onClick={() => onRegionClick?.(region.slug)}>
              {isZh ? region.name_zh : region.name_en}
            </button>
            <span>/</span>
          </>
        )}
        <span className={styles.breadcrumbCurrent}>
          {isZh ? product.name_zh : product.name_en}
        </span>
      </div>

      <div className={styles.content}>
        {/* Left Column */}
        <div className={styles.mainCol}>
          {/* Image Gallery */}
          {images.length > 0 && (
            <div className={styles.gallery}>
              <div
                className={styles.mainImage}
                style={{ backgroundImage: `url(${images[currentImage]})` }}
              >
                {images.length > 1 && (
                  <>
                    <button className={`${styles.galleryArrow} ${styles.galleryArrowLeft}`} onClick={goPrevImage}>
                      <ChevronLeft size={20} />
                    </button>
                    <button className={`${styles.galleryArrow} ${styles.galleryArrowRight}`} onClick={goNextImage}>
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}
                <div className={styles.imageCounter}>
                  {currentImage + 1} / {images.length}
                </div>
              </div>
              {images.length > 1 && (
                <div className={styles.thumbnails}>
                  {images.map((img, i) => (
                    <div
                      key={i}
                      className={`${styles.thumb} ${i === currentImage ? styles.thumbActive : ''}`}
                      style={{ backgroundImage: `url(${img})` }}
                      onClick={() => setCurrentImage(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Title & Meta */}
          <div className={styles.titleSection}>
            <h1 className={styles.title}>
              {isZh ? product.name_zh : product.name_en}
            </h1>
            {(product.summary_zh || product.summary_en) && (
              <p className={styles.subtitle}>
                {isZh ? product.summary_zh : product.summary_en}
              </p>
            )}
            <div className={styles.metaRow}>
              <div className={styles.rating}>
                <Star size={16} className={styles.starIcon} />
                <span className={styles.ratingValue}>{product.rating}</span>
                <span className={styles.reviewCount}>({product.review_count} {t('product.reviews')})</span>
              </div>
              {supplier && (
                <span className={styles.supplier}>{supplier.name}</span>
              )}
            </div>
            {tags.length > 0 && (
              <div className={styles.tags}>
                {tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {isZh ? tagLabels[tag]?.zh : tagLabels[tag]?.en}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Highlights */}
          {highlights.length > 0 && (
            <section className={styles.moduleSection}>
              <h2 className={styles.moduleTitle}>{t('product.highlights')}</h2>
              <div className={styles.highlights}>
                {highlights.map((h: ApiProductHighlight) => (
                  <div key={h.id} className={styles.highlightItem}>
                    <CheckCircle size={18} className={styles.highlightIcon} />
                    <div>
                      <strong>{isZh ? h.title_zh : h.title_en}</strong>
                      {(h.desc_zh || h.desc_en) && (
                        <p>{isZh ? h.desc_zh : h.desc_en}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Trip Details */}
          {(product.duration || product.address_zh || product.address_en) && (
            <section className={styles.moduleSection}>
              <h2 className={styles.moduleTitle}>
                {isZh ? '行程信息' : 'Trip Details'}
              </h2>
              <div className={styles.detailGrid}>
                {product.duration && (
                  <div className={styles.detailItem}>
                    <Clock size={16} />
                    <div>
                      <span className={styles.detailLabel}>{t('product.duration')}</span>
                      <span>{product.duration}</span>
                    </div>
                  </div>
                )}
                {(product.address_zh || product.address_en) && (
                  <div className={styles.detailItem}>
                    <MapPin size={16} />
                    <div>
                      <span className={styles.detailLabel}>{t('product.meetingPoint')}</span>
                      <span>{isZh ? product.address_zh : product.address_en}</span>
                    </div>
                  </div>
                )}
                {product.group_size && (
                  <div className={styles.detailItem}>
                    <Info size={16} />
                    <div>
                      <span className={styles.detailLabel}>{isZh ? '团组规模' : 'Group Size'}</span>
                      <span>{product.group_size}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Description */}
          {(product.description_zh || product.description_en) && (
            <section className={styles.moduleSection}>
              <h2 className={styles.moduleTitle}>
                {isZh ? '详细介绍' : 'Description'}
              </h2>
              <div className={styles.descriptionContent}>
                {(isZh ? product.description_zh : product.description_en)
                  .split('\n')
                  .filter(Boolean)
                  .map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
              </div>
            </section>
          )}

          {/* FAQs */}
          {faqs.length > 0 && (
            <section className={styles.moduleSection}>
              <h2 className={styles.moduleTitle}>
                {isZh ? '常见问题' : 'FAQ'}
              </h2>
              <div className={styles.faqList}>
                {faqs.map((faq: ApiProductFAQ, i: number) => (
                  <div key={faq.id} className={styles.faqItem}>
                    <button
                      className={styles.faqQuestion}
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    >
                      <span>{isZh ? faq.question_zh : faq.question_en}</span>
                      {expandedFaq === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    {expandedFaq === i && (
                      <div className={styles.faqAnswer}>
                        {isZh ? faq.answer_zh : faq.answer_en}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column - Sticky Booking */}
        <aside className={styles.sideCol}>
          <div className={styles.bookingCard}>
            <div className={styles.bookingPrice}>
              <span className={styles.priceLabel}>{isZh ? '起' : 'from'}</span>
              <span className={styles.priceAmount}>A${product.price_from}</span>
              <span className={styles.pricePer}>{isZh ? '/人' : '/person'}</span>
            </div>

            {packages.length > 0 && (
              <div className={styles.packageList}>
                {packages.map((pkg: ApiProductPackage) => (
                  <div key={pkg.id} className={styles.packageItem}>
                    <div className={styles.packageInfo}>
                      <h4>{isZh ? pkg.name_zh : pkg.name_en}</h4>
                      {(pkg.desc_zh || pkg.desc_en) && (
                        <p>{isZh ? pkg.desc_zh : pkg.desc_en}</p>
                      )}
                    </div>
                    <div className={styles.packagePrice}>
                      A${pkg.price}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button className={styles.bookBtn}>
              {t('product.buyNow')}
            </button>

            <p className={styles.bookNote}>
              {isZh ? '预订后即时确认，支持微信/支付宝' : 'Instant confirmation, WeChat/Alipay accepted'}
            </p>
          </div>
        </aside>
      </div>

      <Footer />
    </div>
  );
};

export default AttractionDetailPage;
