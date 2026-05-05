import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { productService } from '../../services/productService';
import styles from './PopularSection.module.css';

export interface PopularProduct {
  id: number;
  name_zh: string;
  name_en: string;
  image: string;
  price_from: number;
  currency: string;
  rating: number;
  order_count: number;
}

interface TagItem {
  id: string | number;
  numId: number;
  label: string;
}

export interface PopularSectionProps {
  defaultProducts: PopularProduct[];
  categories: Array<{ id: string | number; name: string; nameEn?: string }>;
  regions: Array<{ id: string | number; name: string; nameEn?: string }>;
  language: 'zh' | 'en';
  onProductClick?: (productId: number) => void;
}

function getRankColor(rank: number): string {
  switch (rank) {
    case 1: return '#FFD700';
    case 2: return '#C0C0C0';
    case 3: return '#CD7F32';
    default: return '#9ca3af';
  }
}

function currencySymbol(currency: string): string {
  switch (currency) {
    case 'AUD': return 'A$';
    case 'CNY': return '\u00a5';
    default: return currency;
  }
}

export const PopularSection: React.FC<PopularSectionProps> = ({
  defaultProducts,
  categories,
  regions,
  language,
  onProductClick,
}) => {
  const { t } = useTranslation();
  const isZh = language === 'zh';

  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<number | null>(null);
  const [products, setProducts] = useState<PopularProduct[]>(defaultProducts);
  const [loading, setLoading] = useState(false);

  // Update default products when they arrive (async from parent)
  useEffect(() => {
    if (!activeCategoryId && !activeRegionId && defaultProducts.length > 0) {
      setProducts(defaultProducts);
    }
  }, [defaultProducts, activeCategoryId, activeRegionId]);

  const fetchFiltered = useCallback(async (categoryId: number | null, regionId: number | null) => {
    if (!categoryId && !regionId) {
      setProducts(defaultProducts);
      return;
    }
    setLoading(true);
    try {
      const resp = await productService.list({
        page_size: 8,
        ...(categoryId ? { category_id: categoryId } : {}),
        ...(regionId ? { region_id: regionId } : {}),
      });
      const coverImage = (p: { images?: Array<{ url: string; is_cover: boolean }> }) => {
        if (!p.images || p.images.length === 0) return '';
        const cover = p.images.find((img) => img.is_cover);
        return cover ? cover.url : p.images[0].url;
      };
      const items: PopularProduct[] = (resp.items || []).map((p) => ({
        id: p.id,
        name_zh: p.name_zh || '',
        name_en: p.name_en || '',
        image: coverImage(p),
        price_from: p.price_from ?? 0,
        currency: p.currency || 'AUD',
        rating: p.rating ?? 0,
        order_count: p.review_count ?? 0,
      }));
      setProducts(items);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [defaultProducts]);

  const handleCategoryClick = (numId: number) => {
    const newId = activeCategoryId === numId ? null : numId;
    setActiveCategoryId(newId);
    fetchFiltered(newId, activeRegionId);
  };

  const handleRegionClick = (numId: number) => {
    const newId = activeRegionId === numId ? null : numId;
    setActiveRegionId(newId);
    fetchFiltered(activeCategoryId, newId);
  };

  const categoryTags: TagItem[] = categories.map((c) => ({
    id: c.id,
    numId: Number(c.id),
    label: isZh ? c.name : (c.nameEn || c.name),
  }));

  const regionTags: TagItem[] = regions.map((r) => ({
    id: r.id,
    numId: Number(r.id),
    label: isZh ? r.name : (r.nameEn || r.name),
  }));

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {t('homepage.popular', { defaultValue: isZh ? '热门活动' : 'Popular Activities' })}
      </h2>

      {/* Tag Filter Bar */}
      <div className={styles.tagBar}>
        {categoryTags.length > 0 && (
          <div className={styles.tagGroup}>
            {categoryTags.map((tag) => (
              <button
                key={`cat-${tag.id}`}
                className={`${styles.tag} ${activeCategoryId === tag.numId ? styles.tagActive : ''}`}
                onClick={() => handleCategoryClick(tag.numId)}
              >
                {tag.label}
              </button>
            ))}
          </div>
        )}
        {regionTags.length > 0 && (
          <div className={styles.tagGroup}>
            {regionTags.map((tag) => (
              <button
                key={`reg-${tag.id}`}
                className={`${styles.tag} ${activeRegionId === tag.numId ? styles.tagActive : ''}`}
                onClick={() => handleRegionClick(tag.numId)}
              >
                {tag.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className={styles.loadingState}>
          {t('common.loading', { defaultValue: isZh ? '加载中...' : 'Loading...' })}
        </div>
      ) : products.length === 0 ? (
        <div className={styles.emptyState}>
          {t('homepage.popularEmpty', { defaultValue: isZh ? '暂无符合条件的活动' : 'No activities match your filters' })}
        </div>
      ) : (
        <div className={styles.grid}>
          {products.map((product, index) => {
            const rank = index + 1;
            return (
              <article
                key={product.id}
                className={styles.card}
                onClick={() => onProductClick?.(product.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onProductClick?.(product.id);
                  }
                }}
              >
                <div className={styles.imageWrapper}>
                  <img
                    src={product.image}
                    alt={isZh ? product.name_zh : product.name_en}
                    className={styles.image}
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.onerror = null;
                      target.style.objectFit = 'contain';
                      target.style.padding = '2rem';
                      target.style.background = '#f1f5f9';
                      target.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>');
                    }}
                  />
                  <span className={styles.rankBadge} style={{ background: getRankColor(rank) }}>
                    {rank}
                  </span>
                </div>
                <div className={styles.content}>
                  <h3 className={styles.productName}>
                    {isZh ? product.name_zh : product.name_en}
                  </h3>
                  <div className={styles.ratingRow}>
                    <div className={styles.stars}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={i < Math.round(product.rating) ? styles.starFilled : styles.starEmpty}
                          fill={i < Math.round(product.rating) ? 'currentColor' : 'none'}
                        />
                      ))}
                    </div>
                    <span className={styles.ratingValue}>{product.rating.toFixed(1)}</span>
                    <span className={styles.orderCount}>
                      {product.order_count.toLocaleString()}{' '}
                      {t('homepage.ordersSuffix', { defaultValue: isZh ? '人已购' : 'booked' })}
                    </span>
                  </div>
                  <div className={styles.priceRow}>
                    <span className={styles.priceLabel}>
                      {t('product.priceFrom', { defaultValue: isZh ? '起' : 'from' })}
                    </span>
                    <span className={styles.price}>
                      {currencySymbol(product.currency)}{product.price_from}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PopularSection;
