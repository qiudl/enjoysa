import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BedDouble, Compass, MapPin, Utensils } from 'lucide-react';
import { Header, Footer } from '../../components/Common';
import { regionService } from '../../services/regionService';
import type { Region } from '../../data/types';
import type { ApiProduct } from '../../services/productService';
import styles from './RegionPage.module.css';

export interface RegionPageProps {
  regionId?: string;
  cartCount?: number;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onSearch?: (keyword: string) => void;
  onBack?: () => void;
}

const CATEGORIES = [
  {
    id: 1,
    slug: 'attractions',
    zh: '景点体验',
    en: 'Attractions & Experiences',
    descZh: '自然奇观、文化地标与当地特色体验',
    descEn: 'Natural wonders, cultural landmarks and local experiences',
    icon: Compass,
  },
  {
    id: 2,
    slug: 'food-wine',
    zh: '美食美酒',
    en: 'Food & Wine',
    descZh: '餐厅、酒庄与独具风土的餐饮体验',
    descEn: 'Restaurants, cellar doors and regional dining',
    icon: Utensils,
  },
  {
    id: 3,
    slug: 'accommodation',
    zh: '特色住宿',
    en: 'Unique Stays',
    descZh: '酒店、度假屋与值得专程停留的旅宿',
    descEn: 'Hotels, retreats and memorable places to stay',
    icon: BedDouble,
  },
] as const;

export const RegionPage: React.FC<RegionPageProps> = ({
  regionId,
  cartCount = 0,
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
    regionService.getBySlug(regionId)
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

  const categoryCounts = useMemo(() => products.reduce<Record<number, number>>((counts, product) => {
    counts[product.category_id] = (counts[product.category_id] || 0) + 1;
    return counts;
  }, {}), [products]);

  const commonHeader = (
    <Header cartCount={cartCount} onLoginClick={onLoginClick} onRegisterClick={onRegisterClick}
      onNavClick={onNavClick} onSearch={onSearch} />
  );

  if (loading) return <div className={styles.page}>{commonHeader}<div className={styles.loading}>{t('common.loading')}</div><Footer /></div>;

  if (!region) {
    return (
      <div className={styles.page}>{commonHeader}<div className={styles.notFound}>
        <h2>{t('error.notFound')}</h2><button data-testid="region-back" onClick={onBack}>{t('common.back')}</button>
      </div><Footer /></div>
    );
  }

  const regionName = isZh ? region.name : region.nameEn;

  return (
    <div className={styles.page}>
      {commonHeader}
      <section className={styles.hero} style={{ backgroundImage: `url(${region.image})` }}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <button data-testid="region-back" className={styles.backBtn} onClick={onBack}>← {t('common.back')}</button>
          <h1 className={styles.heroTitle}>{regionName}</h1>
          <p className={styles.heroTagline}>{isZh ? region.tagline : region.taglineEn}</p>
          <p className={styles.heroDesc}>{isZh ? region.description : region.descriptionEn}</p>
          <div className={styles.heroMeta}><MapPin size={16} /><span>{products.length} {isZh ? '个产品' : 'products'}</span></div>
        </div>
      </section>

      <main className={styles.categorySection}>
        <header className={styles.categoryHeader}>
          <span>{isZh ? '按分类探索' : 'EXPLORE BY CATEGORY'}</span>
          <h2>{isZh ? `发现${regionName}的精彩` : `Discover the best of ${regionName}`}</h2>
          <p>{isZh ? '选择一个分类，查看这个区域内对应的产品。' : 'Choose a category to browse matching products in this region.'}</p>
        </header>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const count = categoryCounts[category.id] || 0;
            return (
              <button
                type="button"
                key={category.slug}
                data-testid={`region-category-${category.slug}`}
                className={styles.categoryCard}
                onClick={() => onNavClick?.(`/products?destination=${region.id}&category=${category.slug}`)}
              >
                <span className={styles.categoryIcon}><Icon size={28} /></span>
                <span className={styles.categoryCopy}>
                  <strong>{isZh ? category.zh : category.en}</strong>
                  <small>{isZh ? category.descZh : category.descEn}</small>
                  <em>{count} {isZh ? '个产品' : count === 1 ? 'product' : 'products'}</em>
                </span>
                <span className={styles.categoryArrow}><ArrowRight size={21} /></span>
              </button>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RegionPage;
