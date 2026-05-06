import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import styles from './PartnerSection.module.css';

export interface PartnerSectionProps {
  partners: Array<{
    id: number;
    name: string;
    logo: string;
    website: string;
  }>;
}

export const PartnerSection: React.FC<PartnerSectionProps> = ({ partners }) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');

  if (partners.length === 0) return null;

  const renderLogo = (partner: PartnerSectionProps['partners'][number]) => {
    const img = (
      <img
        src={partner.logo}
        alt={partner.name}
        className={styles.logo}
        loading="lazy"
      />
    );

    if (partner.website.startsWith('/')) {
      return (
        <Link
          key={partner.id}
          to={partner.website}
          className={styles.logoLink}
          title={partner.name}
        >
          {img}
        </Link>
      );
    }

    return (
      <a
        key={partner.id}
        href={partner.website}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.logoLink}
        title={partner.name}
      >
        {img}
      </a>
    );
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {t('homepage.partners', { defaultValue: isZh ? '探索南澳各地' : 'Destinations across South Australia' })}
      </h2>
      <p className={styles.sectionSubtitle}>
        {t('homepage.partnersSubtitle', { defaultValue: isZh ? '按地区探索' : 'Explore by region' })}
      </p>
      <div className={styles.logoRow}>{partners.map(renderLogo)}</div>
    </section>
  );
};

export default PartnerSection;
