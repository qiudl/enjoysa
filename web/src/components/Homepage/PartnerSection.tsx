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

  const featuredPartners: PartnerSectionProps['partners'] = [
    {
      id: -1,
      name: 'Journey Beyond',
      logo: 'https://www.journeybeyond.com/wp-content/uploads/JB_LOGO.svg',
      website: 'https://www.journeybeyond.com/',
    },
    {
      id: -2,
      name: 'SeaLink Kangaroo Island',
      logo: 'https://cdn.productreview.com.au/resize/listing-picture/de07da50-85df-59c8-93c5-c17519d2fc53?height=600&v=2&width=600',
      website: 'https://www.sealink.com.au/kangaroo-island/',
    },
  ];
  const allPartners = [...featuredPartners, ...partners.filter((partner) =>
    !featuredPartners.some((featured) => featured.name.toLowerCase() === partner.name.toLowerCase()))];

  const renderLogo = (partner: PartnerSectionProps['partners'][number]) => {
    const img = (
      <img
        src={partner.logo}
        alt={partner.name}
        className={`${styles.logo} ${partner.id === -1 ? styles.journeyBeyondLogo : ''}`}
        loading="lazy"
      />
    );

    if (partner.website.startsWith('/')) {
      return (
        <Link
          key={partner.id}
          to={partner.website}
          className={`${styles.logoLink} ${partner.id < 0 ? styles.featuredLogoLink : ''}`}
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
        className={`${styles.logoLink} ${partner.id < 0 ? styles.featuredLogoLink : ''}`}
        title={partner.name}
      >
        {img}
      </a>
    );
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {t('homepage.partners', { defaultValue: isZh ? '合作伙伴' : 'Our Partners' })}
      </h2>
      <div className={styles.logoRow}>{allPartners.map(renderLogo)}</div>
    </section>
  );
};

export default PartnerSection;
