import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
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

const PAGE_SIZE = 20;

type TabKey = 'all' | 'pending' | 'approved' | 'rejected';

export interface ProductReviewListProps {
  onNavigate?: (path: string) => void;
}

export const ProductReviewList: React.FC<ProductReviewListProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductReview[]>([]);
  const [stats, setStats] = useState<ProductReviewStatsData>(defaultStats);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductReview | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = useCallback(async (page = currentPage, status?: TabKey) => {
    setLoading(true);
    try {
      const statusFilter = (status ?? activeTab) === 'all' ? undefined : (status ?? activeTab);
      const result = await adminService.listProducts({
        page,
        page_size: PAGE_SIZE,
        status: statusFilter,
      });
      const items = (result.items || []).map(transformProduct);
      setProducts(items);
      setTotalItems(result.total);
      setTotalPages(result.total_pages || Math.ceil(result.total / PAGE_SIZE));

      // Stats: load all-status counts (only on first load or tab=all)
      if (!statusFilter) {
        const pending = items.filter((p) => p.status === 'pending').length;
        const approved = items.filter((p) => p.status === 'approved').length;
        const rejected = items.filter((p) => p.status === 'rejected').length;
        setStats({ total: result.total, pending, approved, rejected, todayNew: 0 });
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [currentPage, activeTab]);

  useEffect(() => {
    loadData(1);
  }, []);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSelectedIds([]);
    loadData(1, tab);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    setSelectedIds([]);
    loadData(page);
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all', label: t('admin.products.tabs.all'), count: stats.total },
    { key: 'pending', label: t('admin.products.tabs.pending'), count: stats.pending },
    { key: 'approved', label: t('admin.products.tabs.approved'), count: stats.approved },
    { key: 'rejected', label: t('admin.products.tabs.rejected'), count: stats.rejected },
  ];

  // Client-side search filtering (search is not server-side yet)
  const filteredProducts = searchQuery
    ? products.filter((product) => {
        const query = searchQuery.toLowerCase();
        return (
          product.name.toLowerCase().includes(query) ||
          product.nameEn?.toLowerCase().includes(query) ||
          product.supplierName.toLowerCase().includes(query)
        );
      })
    : products;

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
      await adminService.rejectProduct(Number(product.id), reason);
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
    const tab = status === 'total' ? 'all' : status as TabKey;
    handleTabChange(tab);
  };

  const handleEdit = (product: ProductReview) => {
    onNavigate?.(`/admin/products/${product.id}/edit`);
  };

  const handleDelete = async (product: ProductReview) => {
    const msg = t('admin.products.deleteConfirm', { name: product.name });
    if (!window.confirm(msg)) return;
    try {
      await adminService.deleteProduct(Number(product.id));
      // Reload current page after delete
      loadData(currentPage);
    } catch { /* ignore */ }
  };

  const from = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, totalItems);

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
                onClick={() => handleTabChange(tab.key)}
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
          <button
            className={styles.createBtn}
            onClick={() => onNavigate?.('/admin/products/new')}
          >
            <Plus size={16} />
            {t('admin.products.actions.create')}
          </button>
          <button className={styles.iconBtn} onClick={() => loadData(currentPage)} title={t('common.refresh')}>
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
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Pagination */}
      {!loading && totalItems > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            {t('admin.products.showing', { from, to, total: totalItems })}
          </span>
          {totalPages > 1 && (
            <div className={styles.paginationControls}>
              <button
                className={styles.pageBtn}
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === 'ellipsis' ? (
                    <span key={`e${idx}`} className={styles.pageEllipsis}>...</span>
                  ) : (
                    <button
                      key={item}
                      className={clsx(styles.pageBtn, currentPage === item && styles.pageBtnActive)}
                      onClick={() => handlePageChange(item as number)}
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                className={styles.pageBtn}
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
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
