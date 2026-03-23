import React from 'react';
import { useTranslation } from 'react-i18next';
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

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {t('homepage.partners', { defaultValue: isZh ? '合作伙伴' : 'Our Partners' })}
      </h2>
      <div className={styles.logoRow}>
        {partners.map((partner) => (
          <a
            key={partner.id}
            href={partner.website}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.logoLink}
            title={partner.name}
          >
            <img
              src={partner.logo}
              alt={partner.name}
              className={styles.logo}
              loading="lazy"
            />
          </a>
        ))}
      </div>
    </section>
  );
};

export default PartnerSection;
