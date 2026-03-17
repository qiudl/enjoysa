import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Star, Clock } from 'lucide-react';
import { Header, Footer } from '../../components/Common';
import { regionService } from '../../services/regionService';
import type { Region } from '../../data/types';
import type { ApiProduct } from '../../services/productService';
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

  const [region, setRegion] = useState<Region | null>(null);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!regionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    regionService
      .getBySlug(regionId)
      .then((data) => {
        setRegion(data.region);
        setProducts(data.products);
      })
      .catch(() => {
        setRegion(null);
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [regionId]);

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

      {/* Product List */}
      <section className={styles.attractionSection}>
        {products.length > 0 ? (
          <div className={styles.attractionList}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isZh={isZh}
                onClick={() => onAttractionClick?.(String(product.id))}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyProducts}>
            <p>{isZh ? '该区域暂无产品' : 'No products in this region yet'}</p>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
};

interface ProductCardProps {
  product: ApiProduct;
  isZh: boolean;
  onClick?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isZh, onClick }) => {
  const cover = product.images?.find((img) => img.is_cover) || product.images?.[0];
  const coverUrl = cover?.url || '';
  const tags = parseTags(product.tags);

  return (
    <div className={styles.card} onClick={onClick}>
      <div
        className={styles.cardImage}
        style={{ backgroundImage: coverUrl ? `url(${coverUrl})` : undefined }}
      >
        {tags.includes('bestseller') && (
          <span className={styles.badge}>
            {isZh ? '畅销' : 'Bestseller'}
          </span>
        )}
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>
          {isZh ? product.name_zh : product.name_en}
        </h3>
        <p className={styles.cardSubtitle}>
          {isZh ? product.summary_zh : product.summary_en}
        </p>
        <div className={styles.cardMeta}>
          <div className={styles.cardRating}>
            <Star size={14} className={styles.starIcon} />
            <span>{product.rating}</span>
            <span className={styles.reviewCount}>({product.review_count})</span>
          </div>
          {product.duration && (
            <div className={styles.cardDuration}>
              <Clock size={14} />
              <span>{product.duration}</span>
            </div>
          )}
        </div>
        <div className={styles.cardTags}>
          {tags.slice(0, 3).map((tag) => (
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
              A${product.price_from}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionPage;
