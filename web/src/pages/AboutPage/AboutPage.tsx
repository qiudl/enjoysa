import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
} from '../../components/Common';
import styles from './AboutPage.module.css';

export interface AboutPageProps {
  /** 是否登录 */
  isLoggedIn?: boolean;
  /** 用户名 */
  userName?: string;
  /** 用户头像 */
  userAvatar?: string;
  /** 购物车数量 */
  cartCount?: number;
  /** 登录点击 */
  onLoginClick?: () => void;
  /** 注册点击 */
  onRegisterClick?: () => void;
  /** 导航点击 */
  onNavClick?: (path: string) => void;
  /** 搜索 */
  onSearch?: (keyword: string) => void;
}

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  isLoggedIn = false,
  userName,
  userAvatar,
  cartCount = 0,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onSearch,
}) => {
  const { t } = useTranslation();
  const featureItems = t('about.features.items', { returnObjects: true }) as FeatureItem[];

  return (
    <div className={styles.page}>
      <Header
        isLoggedIn={isLoggedIn}
        userName={userName}
        userAvatar={userAvatar}
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
        onSearch={onSearch}
      />

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{t('about.title')}</h1>
          <p className={styles.heroSubtitle}>{t('about.subtitle')}</p>
        </div>
      </section>

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Introduction */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('about.intro.title')}</h2>
            <p className={styles.introText}>{t('about.intro.description')}</p>
          </section>

          {/* Features */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('about.features.title')}</h2>
            <div className={styles.featuresGrid}>
              {featureItems.map((item, index) => (
                <div key={index} className={styles.featureCard}>
                  <span className={styles.featureIcon}>{item.icon}</span>
                  <h3 className={styles.featureTitle}>{item.title}</h3>
                  <p className={styles.featureDesc}>{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Team */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('about.team.title')}</h2>
            <p className={styles.sectionText}>{t('about.team.description')}</p>
          </section>

          {/* Mission */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('about.mission.title')}</h2>
            <p className={styles.sectionText}>{t('about.mission.description')}</p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AboutPage;
