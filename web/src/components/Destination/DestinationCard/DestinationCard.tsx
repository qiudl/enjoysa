import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { MapPin, ArrowRight } from 'lucide-react';
import styles from './DestinationCard.module.css';
import type { Destination } from '../../../types';

export interface DestinationCardProps {
  /** 目的地数据 */
  destination: Destination;
  /** 产品数量 */
  productCount?: number;
  /** 封面图片 */
  coverImage?: string;
  /** 卡片变体 */
  variant?: 'default' | 'compact' | 'featured';
  /** 点击回调 */
  onClick?: (destination: Destination) => void;
  /** 语言 */
  language?: 'zh' | 'en';
}

export const DestinationCard: React.FC<DestinationCardProps> = ({
  destination,
  productCount = 0,
  coverImage,
  variant = 'default',
  onClick,
  language,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const name = isZh ? destination.name : destination.nameEn;
  const region = isZh ? destination.region : destination.regionEn;
  const description = isZh ? destination.description : destination.descriptionEn;

  const defaultImages: Record<string, string> = {
    '袋鼠岛': 'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=800&h=600&fit=crop',
    '巴罗萨谷': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
    '阿德莱德市区': 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=800&h=600&fit=crop',
    '弗林德斯山脉': 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop',
    '艾尔半岛': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop',
  };

  const image = coverImage || defaultImages[destination.name] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop';

  return (
    <article
      className={clsx(styles.card, styles[variant])}
      onClick={() => onClick?.(destination)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(destination);
        }
      }}
    >
      <div className={styles.imageWrapper}>
        <img
          src={image}
          alt={name}
          className={styles.image}
          loading="lazy"
        />
        <div className={styles.overlay} />

        {variant === 'featured' && (
          <div className={styles.badge}>
            {t('destination.featured')}
          </div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.name}>{name}</h3>
          {region && (
            <span className={styles.region}>
              <MapPin size={12} />
              {region}
            </span>
          )}
        </div>

        {variant !== 'compact' && description && (
          <p className={styles.description}>{description}</p>
        )}

        <div className={styles.footer}>
          <span className={styles.productCount}>
            {productCount} {t('destination.products')}
          </span>
          <span className={styles.explore}>
            {t('destination.explore')}
            <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </article>
  );
};

export default DestinationCard;
