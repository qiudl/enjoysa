import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Star, Clock } from 'lucide-react';
import { Header, Footer } from '../../components/Common';
import { getRegionById } from '../../data';
import { getAttractionsByRegion } from '../../data';
import type { Attraction } from '../../data/types';
import styles from './RegionPage.module.css';

export interface RegionPageProps {
  regionId?: string;
  cartCount?: number;
  onAttractionClick?: (attractionId: string) => void;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onSearch?: (keyword: string) => void;
  onBack?: () => void;
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

export const RegionPage: React.FC<RegionPageProps> = ({
  regionId,
  cartCount = 0,
  onAttractionClick,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onSearch,
  onBack,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');

  const region = regionId ? getRegionById(regionId) : undefined;
  const attractions = regionId ? getAttractionsByRegion(regionId) : [];

  if (!region) {
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

  return (
    <div className={styles.page}>
      <Header
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
        onSearch={onSearch}
      />

      {/* Region Hero */}
      <section
        className={styles.hero}
        style={{ backgroundImage: `url(${region.image})` }}
      >
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <button className={styles.backBtn} onClick={onBack}>
            ← {t('common.back')}
          </button>
          <h1 className={styles.heroTitle}>
            {isZh ? region.name : region.nameEn}
          </h1>
          <p className={styles.heroTagline}>
            {isZh ? region.tagline : region.taglineEn}
          </p>
          <p className={styles.heroDesc}>
            {isZh ? region.description : region.descriptionEn}
          </p>
          <div className={styles.heroMeta}>
            <MapPin size={16} />
            <span>{t('region.attractionCount', { count: region.attractionCount })}</span>
          </div>
        </div>
      </section>

      {/* Attraction List */}
      <section className={styles.attractionSection}>
        <div className={styles.attractionList}>
          {attractions.map((attraction) => (
            <AttractionCard
              key={attraction.id}
              attraction={attraction}
              isZh={isZh}
              onClick={() => onAttractionClick?.(attraction.id)}
            />
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

interface AttractionCardProps {
  attraction: Attraction;
  isZh: boolean;
  onClick?: () => void;
}

const AttractionCard: React.FC<AttractionCardProps> = ({ attraction, isZh, onClick }) => {
  return (
    <div className={styles.card} onClick={onClick}>
      <div
        className={styles.cardImage}
        style={{ backgroundImage: `url(${attraction.images[0]})` }}
      >
        {attraction.tags.includes('bestseller') && (
          <span className={styles.badge}>
            {isZh ? '畅销' : 'Bestseller'}
          </span>
        )}
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>
          {isZh ? attraction.name : attraction.nameEn}
        </h3>
        <p className={styles.cardSubtitle}>
          {isZh ? attraction.subtitle : attraction.subtitleEn}
        </p>
        <div className={styles.cardMeta}>
          <div className={styles.cardRating}>
            <Star size={14} className={styles.starIcon} />
            <span>{attraction.rating}</span>
            <span className={styles.reviewCount}>({attraction.reviewCount})</span>
          </div>
          <div className={styles.cardDuration}>
            <Clock size={14} />
            <span>{isZh ? attraction.duration : attraction.durationEn}</span>
          </div>
        </div>
        <div className={styles.cardTags}>
          {attraction.tags.slice(0, 3).map((tag) => (
            <span key={tag} className={styles.cardTag}>
              {isZh ? tagLabels[tag]?.zh : tagLabels[tag]?.en}
            </span>
          ))}
        </div>
        <div className={styles.cardFooter}>
          <div className={styles.price}>
            <span className={styles.priceLabel}>
              {isZh ? '起' : 'from'}
            </span>
            <span className={styles.priceAmount}>
              A${attraction.priceFrom}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionPage;
