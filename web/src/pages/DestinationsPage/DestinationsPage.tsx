import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  SearchBar,
} from '../../components/Common';
import { DestinationCard } from '../../components/Destination';
import type { Destination } from '../../types';
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

// Mock destinations data
const destinations: Destination[] = [
  {
    id: '1',
    name: '袋鼠岛',
    nameEn: 'Kangaroo Island',
    region: '南澳大利亚',
    regionEn: 'South Australia',
    description: '野生动物天堂，自然奇观荟萃。近距离接触袋鼠、考拉、海豹等珍稀动物。',
    descriptionEn: 'A wildlife paradise with natural wonders. Get close to kangaroos, koalas, seals and more.',
    image: 'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=800',
  },
  {
    id: '2',
    name: '巴罗莎谷',
    nameEn: 'Barossa Valley',
    region: '南澳大利亚',
    regionEn: 'South Australia',
    description: '世界级葡萄酒产区，品味醇香美酒与德式风情小镇。',
    descriptionEn: 'World-class wine region with premium wineries and German heritage towns.',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  },
  {
    id: '3',
    name: '阿德莱德',
    nameEn: 'Adelaide',
    region: '南澳大利亚',
    regionEn: 'South Australia',
    description: '南澳首府，文化之都。探索艺术、美食与城市魅力。',
    descriptionEn: 'Capital of South Australia, a cultural hub for arts, food and urban charm.',
    image: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=800',
  },
  {
    id: '4',
    name: '弗林德斯山脉',
    nameEn: 'Flinders Ranges',
    region: '南澳大利亚',
    regionEn: 'South Australia',
    description: '古老山脉，内陆探险。体验澳大利亚原住民文化与壮丽地貌。',
    descriptionEn: 'Ancient mountain ranges for outback adventures and Indigenous culture experiences.',
    image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
  },
  {
    id: '5',
    name: '艾尔半岛',
    nameEn: 'Eyre Peninsula',
    region: '南澳大利亚',
    regionEn: 'South Australia',
    description: '海鲜美食天堂，与海洋动物亲密接触的绝佳目的地。',
    descriptionEn: 'Seafood paradise and the ultimate destination for marine wildlife encounters.',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
  },
  {
    id: '6',
    name: '格雷尔',
    nameEn: 'Glenelg',
    region: '南澳大利亚',
    regionEn: 'South Australia',
    description: '海滨度假胜地，金色沙滩与精彩水上活动。',
    descriptionEn: 'Beachside resort town with golden sands and exciting water activities.',
    image: 'https://images.unsplash.com/photo-1540202403-b7abd6747a18?w=800',
  },
  {
    id: '7',
    name: '维克多港',
    nameEn: 'Victor Harbor',
    region: '南澳大利亚',
    regionEn: 'South Australia',
    description: '观鲸胜地，企鹅家园。南海岸线上的迷人小镇。',
    descriptionEn: 'Whale watching hotspot and penguin sanctuary on the scenic south coast.',
    image: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=800',
  },
  {
    id: '8',
    name: '克莱尔谷',
    nameEn: 'Clare Valley',
    region: '南澳大利亚',
    regionEn: 'South Australia',
    description: '雷司令葡萄酒之乡，骑行与品酒的完美结合。',
    descriptionEn: 'Home of Riesling wines, perfect for cycling and wine tasting adventures.',
    image: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800',
  },
];

// Product count by destination
const destinationProductCounts: Record<string, number> = {
  '1': 28, '2': 15, '3': 42, '4': 12, '5': 18, '6': 22, '7': 10, '8': 8,
};


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
                productCount={destinationProductCounts[destination.id]}
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
