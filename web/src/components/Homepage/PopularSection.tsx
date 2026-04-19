import React from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import styles from './PopularSection.module.css';

export interface PopularSectionProps {
  products: Array<{
    id: number;
    name_zh: string;
    name_en: string;
    image: string;
    price_from: number;
    currency: string;
    rating: number;
    order_count: number;
  }>;
  language: 'zh' | 'en';
  onProductClick?: (productId: number) => void;
}

/** Returns the badge background color based on ranking position (1-indexed). */
function getRankColor(rank: number): string {
  switch (rank) {
    case 1:
      return '#FFD700'; // gold
    case 2:
      return '#C0C0C0'; // silver
    case 3:
      return '#CD7F32'; // bronze
    default:
      return '#9ca3af'; // gray
  }
}

/** Format currency symbol from code. */
function currencySymbol(currency: string): string {
  switch (currency) {
    case 'AUD':
      return 'A$';
    case 'CNY':
      return '\u00a5';
    default:
      return currency;
  }
}

export const PopularSection: React.FC<PopularSectionProps> = ({
  products,
  language,
  onProductClick,
}) => {
  const { t } = useTranslation();
  const isZh = language === 'zh';

  if (products.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {t('homepage.popular', { defaultValue: isZh ? '热门活动' : 'Popular Activities' })}
      </h2>
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
              {/* Image area with ranking badge */}
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
                <span
                  className={styles.rankBadge}
                  style={{ background: getRankColor(rank) }}
                >
                  {rank}
                </span>
              </div>

              {/* Content area */}
              <div className={styles.content}>
                <h3 className={styles.productName}>
                  {isZh ? product.name_zh : product.name_en}
                </h3>

                {/* Rating + order count */}
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

                {/* Price */}
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
    </section>
  );
};

export default PopularSection;
