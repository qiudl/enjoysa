import React, { useState, useEffect, useCallback } from 'react';
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
import { productService, transformApiProduct } from '../../services/productService';
import { regionService } from '../../services/regionService';
import AiFilterBar from '../../components/AI/AiFilterBar/AiFilterBar';
import type { ParsedFilters } from '../../services/aiService';
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
  /** 初始分类 slug */
  initialCategory?: string;
  /** 初始目的地 slug */
  initialDestination?: string;
  /** 每页产品数；区域分类入口固定为 4 */
  initialPageSize?: number;
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

export const ProductListPage: React.FC<ProductListPageProps> = ({
  language = 'zh',
  isLoggedIn = false,
  userName,
  cartCount = 0,
  initialKeyword = '',
  initialCategory = '',
  initialDestination = '',
  initialPageSize = 12,
  loading: externalLoading = false,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onProductClick,
}) => {
  const { t, i18n } = useTranslation();
  const [keyword, setKeyword] = useState(initialKeyword);
  const [sortBy, setSortBy] = useState('recommend');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [filters, setFilters] = useState<Partial<FilterType>>({
    category: initialCategory || undefined,
    destination: initialDestination || undefined,
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoryIds, setCategoryIds] = useState<Record<string, number>>({});
  const [destinationIds, setDestinationIds] = useState<Record<string, number>>({});
  const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false);

  // Fetch filter data
  useEffect(() => {
    Promise.allSettled([
      regionService.getAllRaw(),
      regionService.getCategoriesRaw(),
    ]).then(([regionResult, categoryResult]) => {
      if (regionResult.status === 'fulfilled') {
        setDestinations(regionResult.value.map((region) => ({
          id: region.slug,
          name: region.name_zh,
          nameEn: region.name_en,
          region: '南澳大利亚',
          regionEn: 'South Australia',
        })));
        setDestinationIds(Object.fromEntries(
          regionResult.value.map((region) => [region.slug, region.id]),
        ));
      }
      if (categoryResult.status === 'fulfilled') {
        setCategories(categoryResult.value.map((category) => ({
          id: category.slug,
          name: category.name_zh,
          nameEn: category.name_en,
        })));
        setCategoryIds(Object.fromEntries(
          categoryResult.value.map((category) => [category.slug, category.id]),
        ));
      }
      setFilterOptionsLoaded(true);
    });
  }, []);

  useEffect(() => {
    setKeyword(initialKeyword);
    setFilters((current) => ({
      ...current,
      category: initialCategory || undefined,
      destination: initialDestination || undefined,
    }));
    setCurrentPage(1);
    setPageSize(initialPageSize);
  }, [initialKeyword, initialCategory, initialDestination, initialPageSize]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!filterOptionsLoaded) return;

    setLoading(true);
    try {
      const categoryId = filters.category ? categoryIds[filters.category] : undefined;
      const destinationId = filters.destination ? destinationIds[filters.destination] : undefined;

      if ((filters.category && !categoryId) || (filters.destination && !destinationId)) {
        setProducts([]);
        setTotalProducts(0);
        return;
      }

      const result = await productService.list({
        page: currentPage,
        page_size: pageSize,
        keyword: keyword || undefined,
        category_id: categoryId,
        region_id: destinationId,
      });
      setProducts((result.items || []).map(transformApiProduct));
      setTotalProducts(result.total || 0);
    } catch {
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, keyword, filters.category, filters.destination, categoryIds, destinationIds, filterOptionsLoaded]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

  const isLoading = loading || externalLoading;

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

      {/* Search Bar + AI Filter */}
      <div className={styles.searchSection}>
        <div className={styles.searchContainer}>
          <SearchBar
            placeholder={t('productList.searchPlaceholder')}
            value={keyword}
            size="md"
            onSearch={handleSearch}
          />
          <AiFilterBar
            language={i18n.language?.startsWith('zh') ? 'zh' : 'en'}
            onFiltersApplied={(aiFilters: ParsedFilters) => {
              const newFilters: Partial<FilterType> = { ...filters };
              if (aiFilters.keyword) setKeyword(aiFilters.keyword);
              if (aiFilters.tags?.length) (newFilters as Record<string, unknown>).tags = aiFilters.tags;
              if (aiFilters.max_price) (newFilters as Record<string, unknown>).maxPrice = aiFilters.max_price;
              setFilters(newFilters);
              setCurrentPage(1);
            }}
            onClear={() => { setFilters({}); setKeyword(''); setCurrentPage(1); }}
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
          {isLoading ? (
            <div className={styles.productsGrid}>
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className={styles.productsGrid}>
                {products.map((product) => (
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
                  showQuickJumper={initialPageSize !== 4}
                  showSizeChanger={initialPageSize !== 4}
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
