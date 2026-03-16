import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  SearchBar,
} from '../../components/Common';
import { DestinationCard } from '../../components/Destination';
import type { Destination } from '../../types';
import { regionService } from '../../services/regionService';
import styles from './DestinationsPage.module.css';

export interface DestinationsPageProps {
  /** 是否登录 */
  isLoggedIn?: boolean;
  /** 用户名 */
  userName?: string;
  /** 用户头像 */
  userAvatar?: string;
  /** 购物车数量 */
  cartCount?: number;
  /** 目的地点击 */
  onDestinationClick?: (destination: Destination) => void;
  /** 登录点击 */
  onLoginClick?: () => void;
  /** 注册点击 */
  onRegisterClick?: () => void;
  /** 导航点击 */
  onNavClick?: (path: string) => void;
  /** 搜索 */
  onSearch?: (keyword: string) => void;
}

export const DestinationsPage: React.FC<DestinationsPageProps> = ({
  isLoggedIn = false,
  userName,
  userAvatar,
  cartCount = 0,
  onDestinationClick,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onSearch,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';
  const [destinations, setDestinations] = useState<Destination[]>([]);

  useEffect(() => {
    regionService.getAll().then((regions) => {
      setDestinations(regions.map((r) => ({
        id: r.id,
        name: r.name,
        nameEn: r.nameEn || '',
        region: '南澳大利亚',
        regionEn: 'South Australia',
        description: r.description,
        descriptionEn: r.descriptionEn,
        image: r.image,
      })));
    }).catch(() => {});
  }, []);

  const handleSearch = (keyword: string) => {
    onSearch?.(keyword);
  };

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
          <h1 className={styles.heroTitle}>{t('destination.title')}</h1>
          <p className={styles.heroSubtitle}>{t('destination.subtitle')}</p>
          <div className={styles.heroSearch}>
            <SearchBar
              placeholder={t('destination.searchPlaceholder')}
              size="lg"
              onSearch={handleSearch}
            />
          </div>
        </div>
      </section>

      {/* Destinations Grid */}
      <main className={styles.main}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>{t('destination.allDestinations')}</h2>
          <div className={styles.destinationsGrid}>
            {destinations.map((destination) => (
              <DestinationCard
                key={destination.id}
                destination={destination}
                productCount={0}
                coverImage={destination.image}
                language={currentLang}
                onClick={onDestinationClick}
              />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default DestinationsPage;
