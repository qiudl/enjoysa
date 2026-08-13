import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import type { Region } from '../../../data/types';
import styles from './RegionCard.module.css';

export interface RegionCardProps {
  region: Region;
  variant?: 'default' | 'editorial';
  onClick?: (region: Region) => void;
}

export const RegionCard: React.FC<RegionCardProps> = ({ region, variant = 'default', onClick }) => {
  const { i18n, t } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');

  return (
    <div className={`${styles.card} ${styles[variant]}`} onClick={() => onClick?.(region)} role="button" tabIndex={0}>
      <div
        className={styles.image}
        style={{ backgroundImage: `url(${region.image})` }}
      >
        <div className={styles.imageOverlay} />
        <div className={styles.count}>
          <MapPin size={14} />
          <span>{t('region.attractionCount', { count: region.attractionCount })}</span>
        </div>
      </div>
      <div className={styles.info}>
        <h3 className={styles.name}>
          {isZh ? region.name : region.nameEn}
        </h3>
        <p className={styles.tagline}>
          {isZh ? region.tagline : region.taglineEn}
        </p>
      </div>
    </div>
  );
};

export default RegionCard;
