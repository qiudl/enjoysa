import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download, Plus, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import clsx from 'clsx';
import { ProductReviewStats } from '../../../components/Admin/ProductReviewStats';
import type { ProductReviewStatsData } from '../../../components/Admin/ProductReviewStats';
import { ProductReviewTable } from '../../../components/Admin/ProductReviewTable';
import type { ProductReview, ProductReviewStatus } from '../../../components/Admin/ProductReviewTable';
import { ProductReviewDetail } from '../../../components/Admin/ProductReviewDetail';
import { adminService, type ApiAdminProduct, type BatchProductOpResponse } from '../../../services/adminService';
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

  // REQ-20260509-0019 PR-C: 批量审核。后端 cap 50 + best-effort，
  // 这里直接展示 summary 给 admin 知道有几个 skip + 哪些。
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const showBatchResult = (label: string, resp: BatchProductOpResponse) => {
    const skipped = resp.results.filter((r) => !r.ok);
    const skippedDetail = skipped
      .slice(0, 5)
      .map((r) => `#${r.id}: ${r.error}`)
      .join('\n');
    const more = skipped.length > 5 ? `\n... +${skipped.length - 5} more` : '';
    const msg =
      `${label}: ${resp.summary.success}/${resp.summary.total} succeeded` +
      (skipped.length > 0 ? `\n\nSkipped:\n${skippedDetail}${more}` : '');
    alert(msg);
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    if (selectedIds.length > 50) {
      alert(t('admin.products.batch.tooMany', { defaultValue: 'Cannot select more than 50 at once' }));
      return;
    }
    if (!window.confirm(t('admin.products.batch.confirmApprove', {
      defaultValue: 'Approve {{count}} products at once?',
      count: selectedIds.length,
    }))) return;
    setBatchSubmitting(true);
    try {
      const ids = selectedIds.map((s) => Number(s));
      const resp = await adminService.batchApproveProducts(ids);
      showBatchResult('Batch approve', resp);
      const okSet = new Set(resp.results.filter((r) => r.ok).map((r) => String(r.id)));
      setProducts((prev) => prev.map((p) => (okSet.has(p.id) ? { ...p, status: 'approved' } : p)));
      setSelectedIds([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Batch approve failed');
    }
    setBatchSubmitting(false);
  };

  const handleBatchReject = async () => {
    if (rejectReason.trim() === '') return; // submit button disabled too
    if (selectedIds.length > 50) {
      alert(t('admin.products.batch.tooMany', { defaultValue: 'Cannot select more than 50 at once' }));
      return;
    }
    setBatchSubmitting(true);
    try {
      const ids = selectedIds.map((s) => Number(s));
      const resp = await adminService.batchRejectProducts(ids, rejectReason.trim());
      showBatchResult('Batch reject', resp);
      const okSet = new Set(resp.results.filter((r) => r.ok).map((r) => String(r.id)));
      setProducts((prev) =>
        prev.map((p) =>
          okSet.has(p.id) ? { ...p, status: 'rejected', reviewNote: rejectReason.trim() } : p,
        ),
      );
      setSelectedIds([]);
      setRejectReason('');
      setRejectModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Batch reject failed');
    }
    setBatchSubmitting(false);
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

      {/*
        REQ-20260509-0019 PR-C: Batch action bar — only visible when admin
        has selected one or more rows. Sits between the stats card and the
        toolbar so it doesn't shift the rest of the layout when it appears.
      */}
      {selectedIds.length > 0 && (
        <div className={styles.batchBar} role="region" aria-label="Batch actions">
          <span className={styles.batchBarLabel}>
            {t('admin.products.batch.selected', {
              defaultValue: '{{count}} selected',
              count: selectedIds.length,
            })}
            {selectedIds.length > 50 && (
              <span className={styles.batchBarWarning}>
                {' '}
                · {t('admin.products.batch.capWarn', { defaultValue: 'limit 50' })}
              </span>
            )}
          </span>
          <button
            type="button"
            className={clsx(styles.batchBtn, styles.batchBtnApprove)}
            onClick={handleBatchApprove}
            disabled={batchSubmitting || selectedIds.length === 0 || selectedIds.length > 50}
          >
            <Check size={14} />
            {t('admin.products.batch.approve', { defaultValue: 'Approve all' })}
          </button>
          <button
            type="button"
            className={clsx(styles.batchBtn, styles.batchBtnReject)}
            onClick={() => setRejectModalOpen(true)}
            disabled={batchSubmitting || selectedIds.length === 0 || selectedIds.length > 50}
          >
            <X size={14} />
            {t('admin.products.batch.reject', { defaultValue: 'Reject all' })}
          </button>
          <button
            type="button"
            className={styles.batchBtn}
            onClick={() => setSelectedIds([])}
            disabled={batchSubmitting}
          >
            {t('common.clear', { defaultValue: 'Clear' })}
          </button>
        </div>
      )}

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

      {/*
        REQ-20260509-0019 PR-C: Batch reject reason modal — required to
        force admins to spell out why so suppliers receive actionable
        feedback. window.confirm() works for batch approve (no input
        needed) but reject needs a textarea, hence a real modal.
      */}
      {rejectModalOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => !batchSubmitting && setRejectModalOpen(false)}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>
              {t('admin.products.batch.rejectTitle', {
                defaultValue: 'Reject {{count}} products',
                count: selectedIds.length,
              })}
            </h3>
            <p className={styles.modalHint}>
              {t('admin.products.batch.rejectHint', {
                defaultValue: 'This reason will be sent to every selected supplier.',
              })}
            </p>
            <textarea
              className={styles.modalTextarea}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('admin.products.batch.rejectPlaceholder', {
                defaultValue: 'e.g. Photos do not meet platform quality standards',
              })}
              rows={5}
              autoFocus
              disabled={batchSubmitting}
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.batchBtn}
                onClick={() => setRejectModalOpen(false)}
                disabled={batchSubmitting}
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                type="button"
                className={clsx(styles.batchBtn, styles.batchBtnReject)}
                onClick={handleBatchReject}
                disabled={batchSubmitting || rejectReason.trim() === ''}
              >
                {batchSubmitting
                  ? t('common.processing', { defaultValue: 'Processing…' })
                  : t('admin.products.batch.confirmReject', { defaultValue: 'Reject all' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductReviewList;
