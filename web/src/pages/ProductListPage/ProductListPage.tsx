import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  SearchBar,
  Pagination,
  CardSkeleton,
} from '../../components/Common';
import { ProductCard, ProductFilter } from '../../components/Product';
import type { Product, Destination, ProductCategory, ProductFilter as FilterType } from '../../types';
import styles from './ProductListPage.module.css';

export interface ProductListPageProps {
  /** 当前语言 */
  language?: 'zh' | 'en';
  /** 是否登录 */
  isLoggedIn?: boolean;
  /** 用户名 */
  userName?: string;
  /** 购物车数量 */
  cartCount?: number;
  /** 初始搜索词 */
  initialKeyword?: string;
  /** 加载中 */
  loading?: boolean;
  /** 登录点击 */
  onLoginClick?: () => void;
  /** 注册点击 */
  onRegisterClick?: () => void;
  /** 导航点击 */
  onNavClick?: (path: string) => void;
  /** 产品点击 */
  onProductClick?: (product: Product) => void;
}

// Shared data for products
const destinations: Destination[] = [
  { id: '1', name: '阿德莱德', nameEn: 'Adelaide', region: '南澳大利亚', regionEn: 'South Australia' },
  { id: '2', name: '袋鼠岛', nameEn: 'Kangaroo Island', region: '南澳大利亚', regionEn: 'South Australia' },
  { id: '3', name: '巴罗萨谷', nameEn: 'Barossa Valley', region: '南澳大利亚', regionEn: 'South Australia' },
  { id: '4', name: '格雷尔', nameEn: 'Glenelg', region: '南澳大利亚', regionEn: 'South Australia' },
];

const categories: ProductCategory[] = [
  { id: '1', name: '一日游', nameEn: 'Day Tours' },
  { id: '2', name: '酒庄之旅', nameEn: 'Wine Tours' },
  { id: '3', name: '水上活动', nameEn: 'Water Activities' },
  { id: '4', name: '城市观光', nameEn: 'City Tours' },
];

// Mock products data
const mockProducts: Product[] = [
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
    category: categories[0],
    destination: destinations[1],
    availability: 'available',
    instantConfirmation: true,
    freeCancellation: true,
    supplierId: 'sup-1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: '2',
    title: '巴罗萨谷酒庄之旅',
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
    tags: ['discount'],
    category: categories[1],
    destination: destinations[2],
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
    category: categories[2],
    destination: destinations[3],
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
    tags: ['hot'],
    category: categories[3],
    destination: destinations[0],
    availability: 'available',
    instantConfirmation: true,
    freeCancellation: true,
    supplierId: 'sup-4',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
];

// Generate more products for pagination demo
const allProducts: Product[] = [
  ...mockProducts,
  ...mockProducts.map((p) => ({ ...p, id: `${parseInt(p.id) + 4}` })),
  ...mockProducts.map((p) => ({ ...p, id: `${parseInt(p.id) + 8}` })),
];


export const ProductListPage: React.FC<ProductListPageProps> = ({
  language = 'zh',
  isLoggedIn = false,
  userName,
  cartCount = 0,
  initialKeyword = '',
  loading = false,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onProductClick,
}) => {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState(initialKeyword);
  const [sortBy, setSortBy] = useState('recommend');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [filters, setFilters] = useState<Partial<FilterType>>({});

  const handleSearch = (value: string) => {
    setKeyword(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (newFilters: Partial<FilterType>) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleProductClick = (product: Product) => {
    onProductClick?.(product);
  };

  // Filter and sort products (mock implementation)
  const filteredProducts = allProducts;
  const totalProducts = allProducts.length;

  return (
    <div className={styles.page}>
      <Header
        isLoggedIn={isLoggedIn}
        userName={userName}
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
      />

      {/* Search Bar */}
      <div className={styles.searchSection}>
        <div className={styles.searchContainer}>
          <SearchBar
            placeholder={t('productList.searchPlaceholder')}
            value={keyword}
            size="md"
            onSearch={handleSearch}
          />
        </div>
      </div>

      <div className={styles.mainContent}>
        {/* Filters Sidebar */}
        <aside className={styles.sidebar}>
          <ProductFilter
            filters={filters}
            categories={categories}
            destinations={destinations}
            onChange={handleFilterChange}
          />
        </aside>

        {/* Products Section */}
        <main className={styles.productsSection}>
          {/* Results Header */}
          <div className={styles.resultsHeader}>
            <div className={styles.resultsInfo}>
              <h1 className={styles.resultsTitle}>{t('productList.results')}</h1>
              <span className={styles.resultsCount}>
                {totalProducts} {t('productList.products')}
              </span>
            </div>
            <div className={styles.sortControls}>
              <label className={styles.sortLabel}>{t('productList.sortBy')}</label>
              <select
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="recommend">{t('productList.sortOptions.recommend')}</option>
                <option value="priceLow">{t('productList.sortOptions.priceLow')}</option>
                <option value="priceHigh">{t('productList.sortOptions.priceHigh')}</option>
                <option value="rating">{t('productList.sortOptions.rating')}</option>
                <option value="reviews">{t('productList.sortOptions.reviews')}</option>
              </select>
            </div>
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className={styles.productsGrid}>
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <>
              <div className={styles.productsGrid}>
                {filteredProducts.slice(0, pageSize).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    language={language}
                    onClick={handleProductClick}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className={styles.pagination}>
                <Pagination
                  current={currentPage}
                  total={totalProducts}
                  pageSize={pageSize}
                  showQuickJumper
                  showSizeChanger
                  showTotal
                  language={language}
                  onChange={handlePageChange}
                />
              </div>
            </>
          ) : (
            <div className={styles.noResults}>
              <span className={styles.noResultsIcon}>🔍</span>
              <h3>{t('productList.noResults')}</h3>
              <p>{t('productList.tryOther')}</p>
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default ProductListPage;
