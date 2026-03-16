import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header, Footer, Button, Modal } from '../../../components/Common';
import { get, del } from '../../../services/api';
import type { ApiProduct } from '../../../services/productService';
import styles from './SupplierProductListPage.module.css';

export interface SupplierProduct {
  id: string;
  title: string;
  titleEn: string;
  image: string;
  price: number;
  stock: number;
  status: 'active' | 'inactive' | 'pending' | 'rejected';
  soldCount: number;
  createdAt: string;
}

export interface SupplierProductListPageProps {
  /** 供应商名称 */
  supplierName?: string;
  /** 导航回调 */
  onNavigate?: (path: string) => void;
}

const statusMap: Record<string, SupplierProduct['status']> = {
  approved: 'active',
  offline: 'inactive',
  pending: 'pending',
  rejected: 'rejected',
  draft: 'inactive',
};

function transformProduct(p: ApiProduct): SupplierProduct {
  const cover = p.images?.find((img) => img.is_cover) || p.images?.[0];
  return {
    id: String(p.id),
    title: p.name_zh,
    titleEn: p.name_en,
    image: cover?.url || '',
    price: p.price_from,
    stock: 0,
    status: statusMap[p.status] || 'inactive',
    soldCount: 0,
    createdAt: p.created_at?.split('T')[0] || '',
  };
}

export const SupplierProductListPage: React.FC<SupplierProductListPageProps> = ({
  supplierName = '祥龙旅行社',
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null);

  useEffect(() => {
    get<{ items: ApiProduct[] }>('/supplier/products?page=1&page_size=50', 'supplier')
      .then((result) => {
        setProducts((result.items || []).map(transformProduct));
      })
      .catch(() => {});
  }, []);

  const filters = [
    { key: 'all', label: t('supplier.products.all') },
    { key: 'active', label: t('supplier.products.active') },
    { key: 'inactive', label: t('supplier.products.inactive') },
    { key: 'pending', label: t('supplier.products.pending') },
  ];

  const filteredProducts = products.filter((product) => {
    if (filter !== 'all' && product.status !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        product.title.toLowerCase().includes(query) ||
        product.titleEn.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getStatusStyle = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      active: { bg: '#dcfce7', color: '#166534' },
      inactive: { bg: '#f3f4f6', color: '#6b7280' },
      pending: { bg: '#fef3c7', color: '#92400e' },
      rejected: { bg: '#fee2e2', color: '#991b1b' },
    };
    return styles[status] || styles.inactive;
  };

  const handleDelete = (product: SupplierProduct) => {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (selectedProduct) {
      try {
        await del(`/supplier/products/${selectedProduct.id}`, 'supplier');
        setProducts((prev) => prev.filter((p) => p.id !== selectedProduct.id));
      } catch { /* ignore */ }
    }
    setShowDeleteModal(false);
    setSelectedProduct(null);
  };

  return (
    <div className={styles.page}>
      <Header isLoggedIn userName={supplierName} />

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{t('supplier.products.title')}</h1>
            <Button variant="primary" onClick={() => onNavigate?.('/supplier/products/new')}>
              + {t('supplier.products.addProduct')}
            </Button>
          </div>

          {/* Filters and Search */}
          <div className={styles.toolbar}>
            <div className={styles.filters}>
              {filters.map((f) => (
                <button
                  key={f.key}
                  className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className={styles.search}>
              <input
                type="text"
                placeholder={t('supplier.products.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* Product List */}
          {filteredProducts.length > 0 ? (
            <div className={styles.productList}>
              <div className={styles.listHeader}>
                <span className={styles.colProduct}>{t('supplier.products.productName')}</span>
                <span className={styles.colPrice}>{t('supplier.products.price')}</span>
                <span className={styles.colStock}>{t('supplier.products.stock')}</span>
                <span className={styles.colSold}>{t('supplier.products.soldCount')}</span>
                <span className={styles.colStatus}>{t('supplier.products.status')}</span>
                <span className={styles.colActions}>{t('supplier.products.actions')}</span>
              </div>
              {filteredProducts.map((product) => {
                const statusStyle = getStatusStyle(product.status);
                return (
                  <div key={product.id} className={styles.listRow}>
                    <div className={styles.colProduct}>
                      <img
                        src={product.image}
                        alt={product.title}
                        className={styles.productImage}
                      />
                      <div className={styles.productInfo}>
                        <span className={styles.productTitle}>
                          {product.title}
                        </span>
                        <span className={styles.productDate}>
                          {product.createdAt}
                        </span>
                      </div>
                    </div>
                    <span className={styles.colPrice}>¥{product.price}</span>
                    <span className={`${styles.colStock} ${product.stock === 0 ? styles.outOfStock : ''}`}>
                      {product.stock}
                    </span>
                    <span className={styles.colSold}>{product.soldCount}</span>
                    <span className={styles.colStatus}>
                      <span
                        className={styles.statusBadge}
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                      >
                        {t(`supplier.products.statusLabels.${product.status}`)}
                      </span>
                    </span>
                    <div className={styles.colActions}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => onNavigate?.(`/supplier/products/${product.id}/edit`)}
                      >
                        {t('supplier.products.edit')}
                      </button>
                      {product.status === 'active' ? (
                        <button className={styles.actionBtn}>{t('supplier.products.setOffline')}</button>
                      ) : product.status === 'inactive' ? (
                        <button className={styles.actionBtn}>{t('supplier.products.setOnline')}</button>
                      ) : null}
                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => handleDelete(product)}
                      >
                        {t('supplier.products.delete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📦</span>
              <p className={styles.emptyText}>{t('supplier.products.noProducts')}</p>
              <p className={styles.emptyHint}>{t('supplier.products.addFirst')}</p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        title={t('supplier.products.delete')}
        size="sm"
        onClose={() => setShowDeleteModal(false)}
        onOk={confirmDelete}
      >
        <p>{t('supplier.products.confirmDelete')}</p>
        {selectedProduct && (
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {selectedProduct.title}
          </p>
        )}
      </Modal>
    </div>
  );
};

export default SupplierProductListPage;
