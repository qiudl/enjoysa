import React from 'react';
import { Link } from 'react-router-dom';
import type { CustomBlockConfig } from '../../services/homepageService';
import styles from './CustomBlockSection.module.css';

export interface CustomBlockSectionProps {
  config: CustomBlockConfig;
  language: 'zh' | 'en';
}

export const CustomBlockSection: React.FC<CustomBlockSectionProps> = ({ config, language }) => {
  const isZh = language === 'zh';
  const title = isZh ? config.title_zh : config.title_en;
  const desc = isZh ? config.desc_zh : config.desc_en;
  const ctaText = isZh ? config.cta_text_zh : config.cta_text_en;

  if (!title) return null;

  const cta = config.cta_link && ctaText
    ? config.cta_link.startsWith('/')
      ? <Link to={config.cta_link} className={styles.cta}>{ctaText}</Link>
      : <a href={config.cta_link} target="_blank" rel="noopener noreferrer" className={styles.cta}>{ctaText}</a>
    : null;

  return (
    <section className={styles.section}>
      {config.image_url && (
        <img src={config.image_url} alt={title} className={styles.image} loading="lazy" />
      )}
      <div className={styles.body}>
        <h2 className={styles.title}>{title}</h2>
        {desc && <p className={styles.desc}>{desc}</p>}
        {cta}
      </div>
    </section>
  );
};

export default CustomBlockSection;
