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
import type { BannerSlide } from '../../components/Common/HeroBanner/HeroBanner';
import { get } from '../../services/api';
import { regionService } from '../../services/regionService';
import { productService, transformApiProduct } from '../../services/productService';
import { Search } from 'lucide-react';
import SmartSearchDropdown from '../../components/AI/SmartSearch/SmartSearchDropdown';
import { TestimonialSection, PartnerSection, PopularSection } from '../../components/Homepage';
import { homepagePublicService, type HomepageConfig } from '../../services/homepageService';
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
  /** 酒店搜索回调 */
  onHotelSearch?: (params: { keyword?: string; regionId?: number }) => void;
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


interface ApiBanner {
  id: number;
  title_zh: string;
  title_en: string;
  subtitle_zh: string;
  subtitle_en: string;
  image: string;
  link_url: string;
  sort_order: number;
  status: string;
}

function transformBanner(b: ApiBanner): BannerSlide {
  return {
    id: `banner-${b.id}`,
    image: b.image,
    title: b.title_zh,
    titleEn: b.title_en,
    tags: b.subtitle_zh ? b.subtitle_zh.split(',').map((s) => s.trim()) : [],
    tagsEn: b.subtitle_en ? b.subtitle_en.split(',').map((s) => s.trim()) : [],
    attractionId: b.link_url || '',
  };
}


export const HomePage: React.FC<HomePageProps> = ({
  isLoggedIn = false,
  userName,
  userAvatar,
  cartCount = 0,
  loading = false,
  onSearch,
  onHotelSearch,
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
  const isZh = currentLang === 'zh';
  const [, setSearchKeyword] = useState('');
  const [searchTab, setSearchTab] = useState<'activity' | 'hotel'>('activity');
  const [hotelKeyword, setHotelKeyword] = useState('');
  const [hotelRegionId, setHotelRegionId] = useState<number | undefined>();
  const [regions, setRegions] = useState<Region[]>([]);
  const [categories, setCategories] = useState<(ProductCategory & { productCount?: number })[]>([]);
  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [homepageConfig, setHomepageConfig] = useState<HomepageConfig | null>(null);

  // Fetch homepage CMS config
  useEffect(() => {
    homepagePublicService.getConfig().then(setHomepageConfig).catch(() => {});
  }, []);

  const isModuleVisible = (key: string) => {
    if (!homepageConfig) return true; // show all by default while loading
    const mod = homepageConfig.modules.find((m) => m.module_key === key);
    return mod ? mod.is_visible : true;
  };

  // Fetch banners from API
  useEffect(() => {
    get<ApiBanner[]>('/banners').then((apiBanners) => {
      setBannerSlides(apiBanners.map(transformBanner));
    }).catch(() => {
      // API error - banners stay empty
    });
  }, []);

  // Fetch regions from API
  useEffect(() => {
    regionService.getAll().then((apiRegions) => {
      setRegions(apiRegions);
    }).catch(() => {
      // API error - regions stay empty
    });
  }, []);

  // Fetch categories from API
  useEffect(() => {
    regionService.getCategories().then((apiCategories) => {
      setCategories(apiCategories.map((c) => ({
        id: c.id,
        name: c.name,
        nameEn: c.nameEn,
        icon: c.icon,
        productCount: c.productCount,
      })));
    }).catch(() => {
      // API error - categories stay empty
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

      {/* Search Tabs */}
      <section className={styles.searchSection}>
        <div className={styles.searchContainer}>
          <div className={styles.searchTabs}>
            <button
              className={`${styles.searchTab} ${searchTab === 'activity' ? styles.searchTabActive : ''}`}
              onClick={() => setSearchTab('activity')}
            >
              {t('home.tabActivities')}
            </button>
            <button
              className={`${styles.searchTab} ${searchTab === 'hotel' ? styles.searchTabActive : ''}`}
              onClick={() => setSearchTab('hotel')}
            >
              {t('home.tabHotels')}
            </button>
          </div>
          {searchTab === 'activity' ? (
            <div className={styles.searchBody}>
              <SmartSearchDropdown
                language={currentLang}
                onProductClick={(id) => onProductClick?.({ id: String(id) } as Product)}
              />
            </div>
          ) : (
            <div className={styles.searchBody}>
              <div className={styles.hotelSearchForm}>
                <select
                  className={styles.hotelSelect}
                  value={hotelRegionId || ''}
                  onChange={(e) => setHotelRegionId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">{t('hotel.allRegions')}</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {isZh ? r.name : r.nameEn}
                    </option>
                  ))}
                </select>
                <input
                  className={styles.hotelInput}
                  type="text"
                  value={hotelKeyword}
                  onChange={(e) => setHotelKeyword(e.target.value)}
                  placeholder={t('hotel.keywordPlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onHotelSearch?.({ keyword: hotelKeyword, regionId: hotelRegionId });
                  }}
                />
                <button
                  className={styles.hotelSearchBtn}
                  onClick={() => onHotelSearch?.({ keyword: hotelKeyword, regionId: hotelRegionId })}
                >
                  <Search size={18} />
                  {t('hotel.search')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Region Navigation */}
      {isModuleVisible('regions') && (
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
      )}

      {/* Featured Products */}
      {isModuleVisible('featured') && (
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
      )}

      {/* Categories */}
      {isModuleVisible('categories') && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('home.categories')}</h2>
          <div className={styles.categoriesGrid}>
            {categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                productCount={cat.productCount || 0}
                icon={cat.icon}
                language={currentLang}
                onClick={onCategoryClick}
              />
            ))}
          </div>
        </section>
      )}

      {/* Why Choose Us — CMS driven */}
      {isModuleVisible('features') && (
        <section className={styles.features}>
          <h2 className={styles.sectionTitle}>{t('home.whyChooseUs')}</h2>
          <div className={styles.featuresGrid}>
            {homepageConfig && homepageConfig.features.length > 0
              ? homepageConfig.features.map((f) => (
                  <div className={styles.featureCard} key={f.id}>
                    <span className={styles.featureIcon}>{f.icon}</span>
                    <h3>{isZh ? f.title_zh : f.title_en}</h3>
                    <p>{isZh ? f.desc_zh : f.desc_en}</p>
                  </div>
                ))
              : /* fallback while config loads */
                <>
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
                </>
            }
          </div>
        </section>
      )}

      {/* Popular Activities — CMS driven */}
      {isModuleVisible('popular') && homepageConfig && homepageConfig.popular_products.length > 0 && (
        <PopularSection
          products={homepageConfig.popular_products}
          language={currentLang}
          onProductClick={onProductClick ? (id) => onProductClick({ id: String(id) } as Product) : undefined}
        />
      )}

      {/* Testimonials — CMS driven */}
      {isModuleVisible('testimonials') && homepageConfig && homepageConfig.testimonials.length > 0 && (
        <TestimonialSection
          testimonials={homepageConfig.testimonials}
          language={currentLang}
        />
      )}

      {/* Partners — CMS driven */}
      {isModuleVisible('partners') && homepageConfig && homepageConfig.partners.length > 0 && (
        <PartnerSection partners={homepageConfig.partners} />
      )}

      <Footer />
    </div>
  );
};

export default HomePage;
