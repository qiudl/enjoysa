import React from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import styles from './TestimonialSection.module.css';

export interface TestimonialSectionProps {
  testimonials: Array<{
    id: number;
    author_name: string;
    author_avatar: string;
    content_zh: string;
    content_en: string;
    rating: number;
    product_name_zh: string;
    product_name_en: string;
  }>;
  language: 'zh' | 'en';
}

/**
 * Extracts initials from a name string.
 * For Chinese names, takes the last 1-2 characters.
 * For English names, takes the first letter of the first two words.
 */
function getInitials(name: string): string {
  if (!name) return '?';
  // Check if the name contains CJK characters
  const hasCJK = /[\u4e00-\u9fff]/.test(name);
  if (hasCJK) {
    return name.length >= 2 ? name.slice(-2) : name;
  }
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export const TestimonialSection: React.FC<TestimonialSectionProps> = ({
  testimonials,
  language,
}) => {
  const { t } = useTranslation();
  const isZh = language === 'zh';

  if (testimonials.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {t('homepage.testimonials', { defaultValue: isZh ? '用户评价' : 'What Our Customers Say' })}
      </h2>
      <div className={styles.grid}>
        {testimonials.map((item) => (
          <article key={item.id} className={styles.card}>
            <div className={styles.header}>
              <div className={styles.avatarWrapper}>
                {item.author_avatar ? (
                  <img
                    src={item.author_avatar}
                    alt={item.author_name}
                    className={styles.avatar}
                    loading="lazy"
                  />
                ) : (
                  <span className={styles.avatarFallback}>
                    {getInitials(item.author_name)}
                  </span>
                )}
              </div>
              <div className={styles.authorInfo}>
                <span className={styles.authorName}>{item.author_name}</span>
                <div className={styles.stars}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={i < item.rating ? styles.starFilled : styles.starEmpty}
                      fill={i < item.rating ? 'currentColor' : 'none'}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className={styles.content}>
              {isZh ? item.content_zh : item.content_en}
            </p>
            <div className={styles.productBadge}>
              {isZh ? item.product_name_zh : item.product_name_en}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default TestimonialSection;
