import React, { useState } from 'react';
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
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Header, Footer } from '../../components/Common';
import { getAttractionById, getRegionById } from '../../data';
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

  const attraction = attractionId ? getAttractionById(attractionId) : undefined;
  const region = attraction ? getRegionById(attraction.regionId) : undefined;

  const [currentImage, setCurrentImage] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  if (!attraction) {
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

  const images = attraction.images;
  const goNextImage = () => setCurrentImage((currentImage + 1) % images.length);
  const goPrevImage = () => setCurrentImage((currentImage - 1 + images.length) % images.length);

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
            <button onClick={() => onRegionClick?.(region.id)}>
              {isZh ? region.name : region.nameEn}
            </button>
            <span>/</span>
          </>
        )}
        <span className={styles.breadcrumbCurrent}>
          {isZh ? attraction.name : attraction.nameEn}
        </span>
      </div>

      <div className={styles.content}>
        {/* Left Column */}
        <div className={styles.mainCol}>
          {/* Image Gallery */}
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

          {/* Title & Meta */}
          <div className={styles.titleSection}>
            <h1 className={styles.title}>
              {isZh ? attraction.name : attraction.nameEn}
            </h1>
            <p className={styles.subtitle}>
              {isZh ? attraction.subtitle : attraction.subtitleEn}
            </p>
            <div className={styles.metaRow}>
              <div className={styles.rating}>
                <Star size={16} className={styles.starIcon} />
                <span className={styles.ratingValue}>{attraction.rating}</span>
                <span className={styles.reviewCount}>({attraction.reviewCount} {t('product.reviews')})</span>
              </div>
              <span className={styles.supplier}>{attraction.supplierName}</span>
            </div>
            <div className={styles.tags}>
              {attraction.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {isZh ? tagLabels[tag]?.zh : tagLabels[tag]?.en}
                </span>
              ))}
            </div>
          </div>

          {/* Module 1: Highlights */}
          <section className={styles.moduleSection}>
            <h2 className={styles.moduleTitle}>{t('product.highlights')}</h2>
            <div className={styles.highlights}>
              {attraction.highlights.map((h, i) => (
                <div key={i} className={styles.highlightItem}>
                  <CheckCircle size={18} className={styles.highlightIcon} />
                  <div>
                    <strong>{isZh ? h.title : h.titleEn}</strong>
                    <p>{isZh ? h.description : h.descriptionEn}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Module 2: Trip Details */}
          <section className={styles.moduleSection}>
            <h2 className={styles.moduleTitle}>
              {isZh ? '行程信息' : 'Trip Details'}
            </h2>
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <Clock size={16} />
                <div>
                  <span className={styles.detailLabel}>{t('product.duration')}</span>
                  <span>{isZh ? attraction.duration : attraction.durationEn}</span>
                </div>
              </div>
              <div className={styles.detailItem}>
                <MapPin size={16} />
                <div>
                  <span className={styles.detailLabel}>{t('product.meetingPoint')}</span>
                  <span>{isZh ? attraction.meetingPoint : attraction.meetingPointEn}</span>
                </div>
              </div>
            </div>
            <div className={styles.inclusions}>
              <h3>{t('product.inclusions')}</h3>
              <ul>
                {(isZh ? attraction.inclusions : attraction.inclusionsEn).map((item, i) => (
                  <li key={i}>
                    <CheckCircle size={14} className={styles.inclusionIcon} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Module 3: Voucher & Directions */}
          <section className={styles.moduleSection}>
            <h2 className={styles.moduleTitle}>
              {isZh ? '到达与凭证' : 'Getting There & Voucher'}
            </h2>
            <div className={styles.infoBlock}>
              <Info size={16} className={styles.infoIcon} />
              <div>
                <h4>{isZh ? '电子凭证' : 'E-Voucher'}</h4>
                <p>{isZh ? attraction.voucherInfo : attraction.voucherInfoEn}</p>
              </div>
            </div>
            <div className={styles.infoBlock}>
              <MapPin size={16} className={styles.infoIcon} />
              <div>
                <h4>{isZh ? '如何到达' : 'How to Get There'}</h4>
                <p>{isZh ? attraction.directions : attraction.directionsEn}</p>
              </div>
            </div>
          </section>

          {/* Module 4: FAQs */}
          {attraction.faqs.length > 0 && (
            <section className={styles.moduleSection}>
              <h2 className={styles.moduleTitle}>
                {isZh ? '常见问题' : 'FAQ'}
              </h2>
              <div className={styles.faqList}>
                {attraction.faqs.map((faq, i) => (
                  <div key={i} className={styles.faqItem}>
                    <button
                      className={styles.faqQuestion}
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    >
                      <span>{isZh ? faq.question : faq.questionEn}</span>
                      {expandedFaq === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    {expandedFaq === i && (
                      <div className={styles.faqAnswer}>
                        {isZh ? faq.answer : faq.answerEn}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Module 5: Important Info */}
          <section className={styles.moduleSection}>
            <h2 className={styles.moduleTitle}>
              {isZh ? '用户须知' : 'Important Information'}
            </h2>
            {attraction.whatToBring.length > 0 && (
              <div className={styles.infoBlock}>
                <Info size={16} className={styles.infoIcon} />
                <div>
                  <h4>{isZh ? '请携带' : 'What to Bring'}</h4>
                  <ul className={styles.bringList}>
                    {(isZh ? attraction.whatToBring : attraction.whatToBringEn).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <div className={styles.infoBlock}>
              <AlertTriangle size={16} className={styles.warningIcon} />
              <div>
                <h4>{isZh ? '健康要求' : 'Health Requirements'}</h4>
                <p>{isZh ? attraction.healthRestrictions : attraction.healthRestrictionsEn}</p>
              </div>
            </div>
            <div className={styles.infoBlock}>
              <Info size={16} className={styles.infoIcon} />
              <div>
                <h4>{isZh ? '取消政策' : 'Cancellation Policy'}</h4>
                <p>{isZh ? attraction.cancellationPolicy : attraction.cancellationPolicyEn}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column - Sticky Booking */}
        <aside className={styles.sideCol}>
          <div className={styles.bookingCard}>
            <div className={styles.bookingPrice}>
              <span className={styles.priceLabel}>{isZh ? '起' : 'from'}</span>
              <span className={styles.priceAmount}>A${attraction.priceFrom}</span>
              <span className={styles.pricePer}>{isZh ? '/人' : '/person'}</span>
            </div>

            <div className={styles.packageList}>
              {attraction.packages.map((pkg) => (
                <div key={pkg.id} className={styles.packageItem}>
                  <div className={styles.packageInfo}>
                    <h4>{isZh ? pkg.name : pkg.nameEn}</h4>
                    <p>{isZh ? pkg.description : pkg.descriptionEn}</p>
                  </div>
                  <div className={styles.packagePrice}>
                    A${pkg.price}
                  </div>
                </div>
              ))}
            </div>

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
