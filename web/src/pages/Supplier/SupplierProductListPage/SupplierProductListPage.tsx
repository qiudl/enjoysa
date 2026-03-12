import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header, Footer, Button, Modal } from '../../../components/Common';
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

// Mock products
const mockProducts: SupplierProduct[] = [
  {
    id: '1',
    title: '袋鼠岛一日游',
    titleEn: 'Kangaroo Island Day Tour',
    image: 'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=400',
    price: 389,
    stock: 50,
    status: 'active',
    soldCount: 126,
    createdAt: '2026-01-15',
  },
  {
    id: '2',
    title: '巴罗萨谷酒庄之旅',
    titleEn: 'Barossa Valley Winery Tour',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
    price: 299,
    stock: 30,
    status: 'active',
    soldCount: 89,
    createdAt: '2026-01-10',
  },
  {
    id: '3',
    title: '阿德莱德市区观光',
    titleEn: 'Adelaide City Tour',
    image: 'https://images.unsplash.com/photo-1540202403-b7abd6747a18?w=400',
    price: 159,
    stock: 0,
    status: 'inactive',
    soldCount: 234,
    createdAt: '2026-01-05',
  },
  {
    id: '4',
    title: '维克多港海豚巡游',
    titleEn: 'Victor Harbor Dolphin Cruise',
    image: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=400',
    price: 199,
    stock: 20,
    status: 'pending',
    soldCount: 0,
    createdAt: '2026-01-28',
  },
];

export const SupplierProductListPage: React.FC<SupplierProductListPageProps> = ({
  supplierName = '祥龙旅行社',
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null);

  const filters = [
    { key: 'all', label: t('supplier.products.all') },
    { key: 'active', label: t('supplier.products.active') },
    { key: 'inactive', label: t('supplier.products.inactive') },
    { key: 'pending', label: t('supplier.products.pending') },
  ];

  const filteredProducts = mockProducts.filter((product) => {
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

  const confirmDelete = () => {
    // Handle delete logic
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
