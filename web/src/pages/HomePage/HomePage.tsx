import React, { useState, useEffect } from 'react';
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
import { regions as staticRegions } from '../../data/regions';
import { bannerSlides } from '../../data/bannerSlides';
import { regionService } from '../../services/regionService';
import { productService, transformApiProduct } from '../../services/productService';
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


// Default categories (overridden by API data when available)
const defaultCategories: ProductCategory[] = [
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
  const [regions, setRegions] = useState<Region[]>(staticRegions);
  const [categories, setCategories] = useState<ProductCategory[]>(defaultCategories);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // Fetch regions from API
  useEffect(() => {
    regionService.getAll().then((apiRegions) => {
      if (apiRegions.length > 0) {
        setRegions(apiRegions);
      }
    }).catch(() => {
      // Fallback to static data on error
    });
  }, []);

  // Fetch categories from API
  useEffect(() => {
    regionService.getCategories().then((apiCategories) => {
      if (apiCategories.length > 0) {
        setCategories(apiCategories.map((c) => ({
          id: c.id,
          name: c.name,
          nameEn: c.nameEn,
          icon: c.icon,
        })));
      }
    }).catch(() => {
      // Fallback to static data on error
    });
  }, []);

  // Fetch featured products from API
  useEffect(() => {
    setProductsLoading(true);
    productService.featured().then((apiProducts) => {
      setFeaturedProducts(apiProducts.map(transformApiProduct));
    }).catch(() => {
      // Fallback: empty list on error
    }).finally(() => {
      setProductsLoading(false);
    });
  }, []);

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
          {(loading || productsLoading) ? (
            Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))
          ) : featuredProducts.length === 0 ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8' }}>{t('common.noData', 'No products yet')}</p>
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
