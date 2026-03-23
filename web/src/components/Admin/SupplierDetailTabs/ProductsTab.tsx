import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldOff, RotateCcw } from 'lucide-react';
import { adminService, type ApiAdminProduct } from '../../../services/adminService';
import styles from '../../../pages/Admin/SupplierDetailPage/SupplierDetailPage.module.css';

interface ProductsTabProps {
  supplierId: number;
}

type StatusFilter = 'all' | 'approved' | 'pending' | 'rejected' | 'offline';

export const ProductsTab: React.FC<ProductsTabProps> = ({ supplierId }) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  const [products, setProducts] = useState<ApiAdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Force offline modal state
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [offlineProductId, setOfflineProductId] = useState<number | null>(null);
  const [offlineReason, setOfflineReason] = useState('');

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params: { page: number; page_size: number; status?: string } = {
        page,
        page_size: 10,
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const res = await adminService.getSupplierProducts(supplierId, params);
      setProducts(res.items || []);
      setTotalPages(res.total_pages || 1);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [supplierId, statusFilter, page]);

  const handleForceOffline = (productId: number) => {
    setOfflineProductId(productId);
    setOfflineReason('');
    setOfflineModalOpen(true);
  };

  const confirmForceOffline = async () => {
    if (!offlineProductId || !offlineReason.trim()) return;
    try {
      await adminService.forceOfflineProduct(supplierId, offlineProductId, offlineReason);
      setOfflineModalOpen(false);
      setOfflineProductId(null);
      setOfflineReason('');
      loadProducts();
    } catch {
      // silent
    }
  };

  const handleRestore = async (productId: number) => {
    try {
      await adminService.restoreProduct(supplierId, productId);
      loadProducts();
    } catch {
      // silent
    }
  };

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('admin.suppliers.detail.filter.all') },
    { key: 'approved', label: t('admin.suppliers.detail.filter.approved') },
    { key: 'pending', label: t('admin.suppliers.detail.filter.pending') },
    { key: 'rejected', label: t('admin.suppliers.detail.filter.rejected') },
    { key: 'offline', label: t('admin.suppliers.detail.filter.offline') },
  ];

  return (
    <div>
      {/* Status filter */}
      <div className={styles.filterBar}>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter);
            setPage(1);
          }}
        >
          {statusFilters.map((sf) => (
            <option key={sf.key} value={sf.key}>{sf.label}</option>
          ))}
        </select>
      </div>

      {/* Product Table */}
      <div className={styles.section}>
        {loading ? (
          <div className={styles.empty}>{t('common.loading')}</div>
        ) : products.length === 0 ? (
          <div className={styles.empty}>{t('admin.suppliers.detail.noProducts')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.suppliers.detail.productTable.name')}</th>
                <th>{t('admin.suppliers.detail.productTable.price')}</th>
                <th>{t('admin.suppliers.detail.productTable.status')}</th>
                <th>{t('admin.suppliers.detail.productTable.createdAt')}</th>
                <th>{t('admin.suppliers.detail.productTable.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{isZh ? product.name_zh : product.name_en}</td>
                  <td>${(product.price_from || 0).toFixed(2)}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[product.status] || ''}`}>
                      {t(`admin.suppliers.status.${product.status}`, product.status)}
                    </span>
                  </td>
                  <td>{new Date(product.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className={styles.inlineActions}>
                      {product.status === 'approved' && (
                        <button onClick={() => handleForceOffline(product.id)} title={t('admin.suppliers.detail.forceOffline')}>
                          <ShieldOff size={14} />
                          {t('admin.suppliers.detail.forceOffline')}
                        </button>
                      )}
                      {product.status === 'offline' && (
                        <button onClick={() => handleRestore(product.id)} title={t('admin.suppliers.detail.restore')}>
                          <RotateCcw size={14} />
                          {t('admin.suppliers.detail.restore')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('common.prev')}
          </button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {t('common.next')}
          </button>
        </div>
      )}

      {/* Force Offline Reason Modal */}
      {offlineModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setOfflineModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>{t('admin.suppliers.detail.forceOfflineTitle')}</h2>
            <div className={styles.formGroup}>
              <label>{t('admin.suppliers.detail.offlineReason')}</label>
              <textarea
                value={offlineReason}
                onChange={(e) => setOfflineReason(e.target.value)}
                placeholder={t('admin.suppliers.detail.offlineReasonPlaceholder')}
              />
            </div>
            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setOfflineModalOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                className={styles.dangerBtn}
                onClick={confirmForceOffline}
                disabled={!offlineReason.trim()}
              >
                {t('admin.suppliers.detail.confirmOffline')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsTab;
