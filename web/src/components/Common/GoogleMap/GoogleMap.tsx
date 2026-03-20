import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './GoogleMap.module.css';

export interface GoogleMapProps {
  address: string;
  title?: string;
  height?: number;
  zoom?: number;
  showNavigation?: boolean;
}

export const GoogleMap: React.FC<GoogleMapProps> = ({
  address,
  title,
  height = 300,
  zoom = 15,
  showNavigation = true,
}) => {
  const { t } = useTranslation();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;

  if (!address) return null;

  const encodedAddress = encodeURIComponent(address);
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;

  if (!apiKey) {
    return (
      <div className={styles.fallback}>
        <span className={styles.fallbackIcon}>📍</span>
        <span className={styles.fallbackAddress}>{address}</span>
        {showNavigation && (
          <a
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.navButton}
          >
            {t('product.navigateTo')}
          </a>
        )}
      </div>
    );
  }

  const embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}&zoom=${zoom}`;

  return (
    <div className={styles.container}>
      <iframe
        className={styles.iframe}
        style={{ height }}
        src={embedUrl}
        title={title || address}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      {showNavigation && (
        <a
          href={navigationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.navButton}
        >
          {t('product.navigateTo')}
        </a>
      )}
    </div>
  );
};

export default GoogleMap;
