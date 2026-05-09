import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../../../components/Common';
import { StockAdjustModal } from '../../../components/Common/StockAdjustModal';
import type { ApiProduct } from '../../../services/productService';
import { supplierProductService } from '../../../services/supplierProductService';
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
    stock: p.available_stock ?? p.total_stock ?? 0,
    status: statusMap[p.status] || 'inactive',
    soldCount: (p.total_stock ?? 0) - (p.available_stock ?? 0),
    createdAt: p.created_at?.split('T')[0] || '',
  };
}

export const SupplierProductListPage: React.FC<SupplierProductListPageProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchAction, setBatchAction] = useState<'online' | 'offline' | 'delete'>('online');
  const [batchLoading, setBatchLoading] = useState(false);
  // REQ-20260509-0035 Phase 3a: 库存快速调整 modal
  const [stockModalProduct, setStockModalProduct] = useState<SupplierProduct | null>(null);

  const loadProducts = async () => {
    try {
      const result = await supplierProductService.list({ page: 1, page_size: 50 });
      setProducts((result.items || []).map(transformProduct));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadProducts();
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
        await supplierProductService.remove(Number(selectedProduct.id));
        setProducts((prev) => prev.filter((p) => p.id !== selectedProduct.id));
      } catch { /* ignore */ }
    }
    setShowDeleteModal(false);
    setSelectedProduct(null);
  };

  const handleToggleStatus = async (product: SupplierProduct) => {
    try {
      if (product.status === 'active') {
        await supplierProductService.offline(Number(product.id));
        setProducts((prev) => prev.map((p) =>
          p.id === product.id ? { ...p, status: 'inactive' as const } : p,
        ));
      } else if (product.status === 'inactive') {
        await supplierProductService.online(Number(product.id));
        setProducts((prev) => prev.map((p) =>
          p.id === product.id ? { ...p, status: 'active' as const } : p,
        ));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const openBatchAction = (action: 'online' | 'offline' | 'delete') => {
    setBatchAction(action);
    setShowBatchModal(true);
  };

  const executeBatchAction = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      await supplierProductService.batchAction(batchAction, Array.from(selectedIds).map(Number));
      setSelectedIds(new Set());
      setShowBatchModal(false);
      await loadProducts();
    } catch {
      // error handled
    } finally {
      setBatchLoading(false);
    }
  };

  return (
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

          {/* Batch Action Bar */}
          {selectedIds.size > 0 && (
            <div className={styles.batchBar}>
              <span className={styles.batchCount}>
                {t('supplier.products.selected', { count: selectedIds.size })}
              </span>
              <div className={styles.batchActions}>
                <Button size="sm" variant="primary" onClick={() => openBatchAction('online')}>
                  {t('supplier.products.batchOnline')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openBatchAction('offline')}>
                  {t('supplier.products.batchOffline')}
                </Button>
                <Button size="sm" variant="danger" onClick={() => openBatchAction('delete')}>
                  {t('supplier.products.batchDelete')}
                </Button>
              </div>
            </div>
          )}

          {/* Product List */}
          {filteredProducts.length > 0 ? (
            <div className={styles.productList}>
              <div className={styles.listHeader}>
                <span className={styles.colCheck}>
                  <input type="checkbox" checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0} onChange={toggleSelectAll} />
                </span>
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
                    <span className={styles.colCheck}>
                      <input type="checkbox" checked={selectedIds.has(product.id)} onChange={() => toggleSelect(product.id)} />
                    </span>
                    <div className={styles.colProduct}>
                      <img
                        src={product.image || ''}
                        alt={product.title}
                        className={styles.productImage}
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.onerror = null;
                          target.style.objectFit = 'contain';
                          target.style.padding = '0.5rem';
                          target.style.background = '#f1f5f9';
                          target.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>');
                        }}
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
                    <span className={styles.colPrice}>A${product.price}</span>
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
                      <button
                        className={styles.actionBtn}
                        onClick={() => onNavigate?.(`/supplier/products/${product.id}/schedules`)}
                      >
                        {t('supplier.products.schedules')}
                      </button>
                      <button
                        className={styles.actionBtn}
                        onClick={() => onNavigate?.(`/supplier/products/${product.id}/preview`)}
                      >
                        {t('supplier.preview.title')}
                      </button>
                      {/* REQ-20260509-0035 Phase 3a: 列表页一键调库存 */}
                      <button
                        className={styles.actionBtn}
                        onClick={() => setStockModalProduct(product)}
                      >
                        {t('supplier.products.adjustStock', { defaultValue: '调整库存' })}
                      </button>
                      {product.status === 'active' ? (
                        <button className={styles.actionBtn} onClick={() => handleToggleStatus(product)}>{t('supplier.products.setOffline')}</button>
                      ) : product.status === 'inactive' ? (
                        <button className={styles.actionBtn} onClick={() => handleToggleStatus(product)}>{t('supplier.products.setOnline')}</button>
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

      {/* REQ-20260509-0035 Phase 3a: 库存快速调整 modal（supplier 走 supplier endpoint） */}
      <StockAdjustModal
        productId={stockModalProduct ? Number(stockModalProduct.id) : null}
        productName={stockModalProduct?.title}
        open={stockModalProduct !== null}
        onClose={() => setStockModalProduct(null)}
        onSaved={loadProducts}
        loadProduct={(id) => supplierProductService.getById(id)}
        saveStock={(productId, packageId, stockTotal) =>
          supplierProductService.updatePackageStock(productId, packageId, stockTotal)}
      />

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

      {/* Batch Action Confirmation Modal */}
      <Modal
        open={showBatchModal}
        title={t(`supplier.products.batch${batchAction.charAt(0).toUpperCase() + batchAction.slice(1)}`)}
        size="sm"
        onClose={() => setShowBatchModal(false)}
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setShowBatchModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={batchAction === 'delete' ? 'danger' : 'primary'}
              onClick={executeBatchAction}
              disabled={batchLoading}
            >
              {batchLoading ? t('common.processing') : t('common.confirm')}
            </Button>
          </div>
        }
      >
        <p>{t('supplier.products.batchConfirm', { count: selectedIds.size, action: t(`supplier.products.batch${batchAction.charAt(0).toUpperCase() + batchAction.slice(1)}`) })}</p>
      </Modal>
    </div>
  );
};

export default SupplierProductListPage;
