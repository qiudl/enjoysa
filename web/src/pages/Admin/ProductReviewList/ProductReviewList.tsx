import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download } from 'lucide-react';
import clsx from 'clsx';
import { ProductReviewStats } from '../../../components/Admin/ProductReviewStats';
import type { ProductReviewStatsData } from '../../../components/Admin/ProductReviewStats';
import { ProductReviewTable } from '../../../components/Admin/ProductReviewTable';
import type { ProductReview, ProductReviewStatus } from '../../../components/Admin/ProductReviewTable';
import { ProductReviewDetail } from '../../../components/Admin/ProductReviewDetail';
import { adminService, type ApiAdminProduct } from '../../../services/adminService';
import styles from './ProductReviewList.module.css';

function transformProduct(p: ApiAdminProduct): ProductReview {
  const coverImg = p.images?.find((img) => img.is_cover) || p.images?.[0];
  return {
    id: String(p.id),
    name: p.name_zh,
    nameEn: p.name_en,
    category: (p.category?.slug || 'other') as ProductReview['category'],
    supplierId: String(p.supplier_id),
    supplierName: p.supplier?.name || '',
    price: p.price_from,
    status: p.status as ProductReviewStatus,
    submittedAt: p.created_at,
    thumbnail: coverImg?.url,
  };
}

const defaultStats: ProductReviewStatsData = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  todayNew: 0,
};

type TabKey = 'all' | 'pending' | 'approved' | 'rejected';

export const ProductReviewList: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductReview[]>([]);
  const [stats, setStats] = useState<ProductReviewStatsData>(defaultStats);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductReview | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await adminService.listProducts({ page: 1, page_size: 50 });
      const items = (result.items || []).map(transformProduct);
      setProducts(items);
      const pending = items.filter((p) => p.status === 'pending').length;
      const approved = items.filter((p) => p.status === 'approved').length;
      const rejected = items.filter((p) => p.status === 'rejected').length;
      setStats({ total: result.total, pending, approved, rejected, todayNew: 0 });
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all', label: t('admin.products.tabs.all'), count: stats.total },
    { key: 'pending', label: t('admin.products.tabs.pending'), count: stats.pending },
    { key: 'approved', label: t('admin.products.tabs.approved'), count: stats.approved },
    { key: 'rejected', label: t('admin.products.tabs.rejected'), count: stats.rejected },
  ];

  const filteredProducts = products.filter((product) => {
    // Filter by tab
    if (activeTab !== 'all' && product.status !== activeTab) {
      return false;
    }
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(query) ||
        product.nameEn?.toLowerCase().includes(query) ||
        product.supplierName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleView = (product: ProductReview) => {
    setSelectedProduct(product);
    setDetailOpen(true);
  };

  const handleApprove = async (product: ProductReview) => {
    try {
      await adminService.approveProduct(Number(product.id));
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: 'approved' as ProductReviewStatus } : p))
      );
    } catch { /* ignore */ }
    setDetailOpen(false);
  };

  const handleReject = async (product: ProductReview, reason: string) => {
    try {
      await adminService.rejectProduct(Number(product.id));
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? { ...p, status: 'rejected' as ProductReviewStatus, reviewNote: reason }
            : p
        )
      );
    } catch { /* ignore */ }
    setDetailOpen(false);
  };

  const handleStatClick = (status: string) => {
    if (status === 'total') {
      setActiveTab('all');
    } else {
      setActiveTab(status as TabKey);
    }
  };

  return (
    <div className={styles.page}>
      {/* Stats */}
      <ProductReviewStats data={stats} loading={loading} onStatClick={handleStatClick} />

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* Tabs */}
          <div className={styles.tabs}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={clsx(styles.tab, activeTab === tab.key && styles.active)}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={styles.tabCount}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          {/* Search */}
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t('admin.products.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Actions */}
          <button className={styles.iconBtn} onClick={loadData} title={t('common.refresh')}>
            <RefreshCw size={18} />
          </button>
          <button className={styles.iconBtn} title={t('admin.products.export')}>
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Table */}
      <ProductReviewTable
        products={filteredProducts}
        loading={loading}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        onView={handleView}
        onApprove={handleApprove}
        onReject={(p) => handleReject(p, '')}
      />

      {/* Pagination */}
      {!loading && filteredProducts.length > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            {t('admin.products.showing', {
              from: 1,
              to: filteredProducts.length,
              total: filteredProducts.length,
            })}
          </span>
        </div>
      )}

      {/* Detail Drawer */}
      <ProductReviewDetail
        product={selectedProduct}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
};

export default ProductReviewList;
