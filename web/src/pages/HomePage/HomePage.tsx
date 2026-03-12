import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  SearchBar,
  CardSkeleton,
  HeroBanner,
  RegionCard,
} from '../../components/Common';
import { ProductCard } from '../../components/Product';
import { CategoryCard } from '../../components/Category';
import type { Product, ProductCategory } from '../../types';
import type { Region } from '../../data/types';
import { regions } from '../../data/regions';
import { bannerSlides } from '../../data/bannerSlides';
import styles from './HomePage.module.css';

export interface HomePageProps {
  /** 是否登录 */
  isLoggedIn?: boolean;
  /** 用户名 */
  userName?: string;
  /** 用户头像 */
  userAvatar?: string;
  /** 购物车数量 */
  cartCount?: number;
  /** 加载中 */
  loading?: boolean;
  /** 搜索回调 */
  onSearch?: (keyword: string) => void;
  /** 产品点击 */
  onProductClick?: (product: Product) => void;
  /** 区域点击 */
  onRegionClick?: (region: Region) => void;
  /** 景点点击（Banner） */
  onAttractionClick?: (attractionId: string) => void;
  /** 分类点击 */
  onCategoryClick?: (category: ProductCategory) => void;
  /** 登录点击 */
  onLoginClick?: () => void;
  /** 注册点击 */
  onRegisterClick?: () => void;
  /** 导航点击 */
  onNavClick?: (path: string) => void;
}

// Shared destination and category data for products
const sharedCategory: ProductCategory = {
  id: 'day-tour',
  name: '一日游',
  nameEn: 'Day Tours',
};

// Mock data - Products
const featuredProducts: Product[] = [
  {
    id: '1',
    title: '袋鼠岛一日游',
    titleEn: 'Kangaroo Island Day Tour',
    description: '探索南澳最著名的野生动物天堂',
    images: ['https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=400'],
    price: 389,
    currency: 'CNY',
    rating: 4.8,
    reviewCount: 126,
    location: '阿德莱德出发',
    locationEn: 'Depart from Adelaide',
    highlights: ['野生动物', '海豹湾', '神奇岩石'],
    inclusions: ['往返交通', '午餐', '导游'],
    exclusions: ['个人消费'],
    tags: ['hot', 'recommended'],
    category: sharedCategory,
    destination: { id: 'kangaroo-island', name: '袋鼠岛', nameEn: 'Kangaroo Island', region: '南澳大利亚', regionEn: 'South Australia' },
    availability: 'available',
    instantConfirmation: true,
    freeCancellation: true,
    supplierId: 'sup-1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: '2',
    title: '巴罗莎谷酒庄之旅',
    titleEn: 'Barossa Valley Winery Tour',
    description: '品味世界级葡萄酒',
    images: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'],
    price: 299,
    originalPrice: 399,
    currency: 'CNY',
    rating: 4.9,
    reviewCount: 89,
    location: '阿德莱德出发',
    locationEn: 'Depart from Adelaide',
    highlights: ['品酒体验', '酒庄参观', '美食午餐'],
    inclusions: ['往返交通', '品酒费用', '午餐'],
    exclusions: ['个人消费', '酒品购买'],
    tags: ['discount', 'food'],
    category: { ...sharedCategory, id: 'wine-tour', name: '酒庄之旅', nameEn: 'Wine Tour' },
    destination: { id: 'barossa', name: '巴罗莎谷', nameEn: 'Barossa Valley', region: '南澳大利亚', regionEn: 'South Australia' },
    availability: 'available',
    instantConfirmation: true,
    freeCancellation: true,
    supplierId: 'sup-2',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: '3',
    title: '海豚巡航体验',
    titleEn: 'Dolphin Cruise Experience',
    description: '与海豚近距离接触',
    images: ['https://images.unsplash.com/photo-1540202403-b7abd6747a18?w=400'],
    price: 159,
    currency: 'CNY',
    rating: 4.7,
    reviewCount: 234,
    location: '格雷尔海滩',
    locationEn: 'Glenelg Beach',
    highlights: ['海豚观赏', '海景巡航'],
    inclusions: ['船票', '解说服务'],
    exclusions: ['交通', '餐饮'],
    tags: ['family'],
    category: { ...sharedCategory, id: 'cruise', name: '水上活动', nameEn: 'Water Activities' },
    destination: { id: 'glenelg', name: '格雷尔', nameEn: 'Glenelg', region: '南澳大利亚', regionEn: 'South Australia' },
    availability: 'available',
    instantConfirmation: true,
    freeCancellation: false,
    supplierId: 'sup-3',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: '4',
    title: '阿德莱德城市观光',
    titleEn: 'Adelaide City Sightseeing',
    description: '探索南澳首府的魅力',
    images: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'],
    price: 129,
    currency: 'CNY',
    rating: 4.6,
    reviewCount: 156,
    location: '市中心',
    locationEn: 'City Center',
    highlights: ['城市地标', '博物馆', '购物区'],
    inclusions: ['导游', '门票'],
    exclusions: ['午餐', '个人消费'],
    tags: ['hot', 'culture'],
    category: { ...sharedCategory, id: 'city-tour', name: '城市观光', nameEn: 'City Tour' },
    destination: { id: 'adelaide', name: '阿德莱德', nameEn: 'Adelaide', region: '南澳大利亚', regionEn: 'South Australia' },
    availability: 'available',
    instantConfirmation: true,
    freeCancellation: true,
    supplierId: 'sup-4',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
];

// Mock data - Categories
const categories: ProductCategory[] = [
  { id: '1', name: '野生动物', nameEn: 'Wildlife', icon: '🦘' },
  { id: '2', name: '美食美酒', nameEn: 'Food & Wine', icon: '🍷' },
  { id: '3', name: '海滨休闲', nameEn: 'Beach & Coastal', icon: '🏖️' },
  { id: '4', name: '自驾路线', nameEn: 'Self-Drive', icon: '🚗' },
  { id: '5', name: '亲子活动', nameEn: 'Family Fun', icon: '👨‍👩‍👧‍👦' },
  { id: '6', name: '文化体验', nameEn: 'Culture', icon: '🎭' },
];

const categoryProductCounts: Record<string, number> = {
  '1': 35, '2': 28, '3': 22, '4': 18, '5': 25, '6': 15,
};


export const HomePage: React.FC<HomePageProps> = ({
  isLoggedIn = false,
  userName,
  userAvatar,
  cartCount = 0,
  loading = false,
  onSearch,
  onProductClick,
  onRegionClick,
  onAttractionClick,
  onCategoryClick,
  onLoginClick,
  onRegisterClick,
  onNavClick,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';
  const [, setSearchKeyword] = useState('');

  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
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

      {/* Hero Banner */}
      <HeroBanner
        slides={bannerSlides}
        onSlideClick={onAttractionClick}
      />

      {/* Search Bar */}
      <section className={styles.searchSection}>
        <div className={styles.searchContainer}>
          <SearchBar
            placeholder={t('home.searchPlaceholder')}
            size="lg"
            onSearch={handleSearch}
          />
        </div>
      </section>

      {/* Region Navigation */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('region.title')}</h2>
          <p className={styles.sectionSubtitle}>{t('region.subtitle')}</p>
        </div>
        <div className={styles.regionsGrid}>
          {regions.map((region) => (
            <RegionCard
              key={region.id}
              region={region}
              onClick={onRegionClick}
            />
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('home.featuredProducts')}</h2>
          <button className={styles.viewAllBtn}>{t('common.viewAll')} →</button>
        </div>
        <div className={styles.productsGrid}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))
          ) : (
            featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                language={currentLang}
                onClick={onProductClick}
              />
            ))
          )}
        </div>
      </section>

      {/* Categories */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('home.categories')}</h2>
        <div className={styles.categoriesGrid}>
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              productCount={categoryProductCounts[cat.id]}
              icon={cat.icon}
              language={currentLang}
              onClick={onCategoryClick}
            />
          ))}
        </div>
      </section>

      {/* Why Choose Us */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>{t('home.whyChooseUs')}</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>🇨🇳</span>
            <h3>{t('home.localExpert')}</h3>
            <p>{t('home.localExpertDesc')}</p>
          </div>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>💳</span>
            <h3>{t('home.bestPrice')}</h3>
            <p>{t('home.bestPriceDesc')}</p>
          </div>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>⭐</span>
            <h3>{t('home.easyBooking')}</h3>
            <p>{t('home.easyBookingDesc')}</p>
          </div>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>💰</span>
            <h3>{t('home.support247')}</h3>
            <p>{t('home.support247Desc')}</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;
