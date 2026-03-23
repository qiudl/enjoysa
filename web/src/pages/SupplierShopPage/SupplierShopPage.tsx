import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Star, Phone, Package, Loader2 } from 'lucide-react';
import { Header, Footer, CardSkeleton } from '../../components/Common';
import { ProductCard } from '../../components/Product/ProductCard/ProductCard';
import type { Product } from '../../types';
import { supplierPublicService, transformApiProduct } from '../../services/productService';
import type { ApiSupplierProfile } from '../../services/productService';
import styles from './SupplierShopPage.module.css';

export interface SupplierShopPageProps {
  supplierId?: string;
  cartCount?: number;
  onProductClick?: (product: Product) => void;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onSearch?: (keyword: string) => void;
}

export const SupplierShopPage: React.FC<SupplierShopPageProps> = ({
  supplierId,
  cartCount = 0,
  onProductClick,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onSearch,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const [supplier, setSupplier] = useState<ApiSupplierProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    if (!supplierId) return;
    const id = Number(supplierId);
    if (!id) return;

    setLoading(true);
    supplierPublicService.getProfile(id).then((data) => {
      setSupplier(data);
    }).catch(() => {
      // supplier not found
    }).finally(() => {
      setLoading(false);
    });

    setProductsLoading(true);
    supplierPublicService.getProducts(id).then((data) => {
      setProducts((data.items || []).map(transformApiProduct));
    }).catch(() => {
      // products load failed
    }).finally(() => {
      setProductsLoading(false);
    });
  }, [supplierId]);

  if (loading) {
    return (
      <div className={styles.page}>
        <Header
          cartCount={cartCount}
          onLoginClick={onLoginClick}
          onRegisterClick={onRegisterClick}
          onNavClick={onNavClick}
          onSearch={onSearch}
        />
        <main className={styles.main}>
          <div className={styles.loadingContainer}>
            <Loader2 size={32} className={styles.spinner} />
          </div>
        </main>
        <Footer onNavClick={onNavClick} />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className={styles.page}>
        <Header
          cartCount={cartCount}
          onLoginClick={onLoginClick}
          onRegisterClick={onRegisterClick}
          onNavClick={onNavClick}
          onSearch={onSearch}
        />
        <main className={styles.main}>
          <div className={styles.emptyContainer}>
            <p>{t('common.notFound', 'Supplier not found')}</p>
          </div>
        </main>
        <Footer onNavClick={onNavClick} />
      </div>
    );
  }

  const location = [supplier.city, supplier.state, supplier.country].filter(Boolean).join(', ');

  return (
    <div className={styles.page}>
      <Header
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
        onSearch={onSearch}
      />

      <main className={styles.main}>
        {/* Shop Banner */}
        <section className={styles.banner}>
          <div className={styles.bannerContent}>
            {supplier.logo ? (
              <img src={supplier.logo} alt={supplier.name} className={styles.shopLogoImg} />
            ) : (
              <div className={styles.shopLogo}>{supplier.name.charAt(0)}</div>
            )}
            <h1 className={styles.shopName}>{supplier.name}</h1>
            <span className={styles.shopType}>{t(`supplier.types.${supplier.type}`)}</span>

            <div className={styles.shopStats}>
              <div className={styles.stat}>
                <div className={styles.statValue}>
                  <Star size={18} fill="#facc15" color="#facc15" />
                  {supplier.rating > 0 ? supplier.rating.toFixed(1) : '-'}
                </div>
                <div className={styles.statLabel}>{t('shop.rating')}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{supplier.product_count}</div>
                <div className={styles.statLabel}>{t('shop.products')}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{supplier.review_count}</div>
                <div className={styles.statLabel}>{t('shop.reviews')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Info */}
        <section className={styles.infoSection}>
          <div className={styles.infoCard}>
            {location && (
              <div className={styles.infoItem}>
                <MapPin size={16} />
                <span>{location}</span>
              </div>
            )}
            {supplier.phone && (
              <div className={styles.infoItem}>
                <Phone size={16} />
                <span>{supplier.phone}</span>
              </div>
            )}
            {supplier.description && (
              <div className={styles.infoItem}>
                <Package size={16} />
                <span>{supplier.description}</span>
              </div>
            )}
          </div>
        </section>

        {/* Products */}
        <section className={styles.productsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('shop.allProducts')}</h2>
            <span className={styles.productCount}>
              {supplier.product_count} {t('shop.items')}
            </span>
          </div>
          <div className={styles.productGrid}>
            {productsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))
            ) : products.length === 0 ? (
              <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8' }}>
                {t('common.noData', 'No products yet')}
              </p>
            ) : (
              products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  language={isZh ? 'zh' : 'en'}
                  onClick={() => onProductClick?.(product)}
                />
              ))
            )}
          </div>
        </section>

        {/* Reviews - placeholder until review system is built */}
        <section className={styles.reviewsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('shop.recentReviews')}</h2>
          </div>
          <div className={styles.reviewList}>
            {supplier.review_count === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>
                {t('common.noData', 'No reviews yet')}
              </p>
            ) : (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>
                {t('common.comingSoon', 'Reviews coming soon')}
              </p>
            )}
          </div>
        </section>
      </main>

      <Footer onNavClick={onNavClick} />
    </div>
  );
};

export default SupplierShopPage;
