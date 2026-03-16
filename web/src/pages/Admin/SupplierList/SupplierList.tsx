import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Download, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { SupplierStats } from '../../../components/Admin/SupplierStats';
import type { SupplierStatsData } from '../../../components/Admin/SupplierStats';
import { SupplierTable } from '../../../components/Admin/SupplierTable';
import type { Supplier, SupplierStatus } from '../../../components/Admin/SupplierTable';
import { SupplierDetail } from '../../../components/Admin/SupplierDetail';
import { SupplierForm } from '../../../components/Admin/SupplierForm';
import type { SupplierFormData } from '../../../components/Admin/SupplierForm';
import { adminService, type ApiSupplier } from '../../../services/adminService';
import styles from './SupplierList.module.css';

function transformSupplier(s: ApiSupplier): Supplier {
  return {
    id: String(s.id),
    name: s.name,
    type: s.type as Supplier['type'],
    contactName: s.name,
    contactPhone: s.phone,
    contactEmail: s.email,
    status: s.status as SupplierStatus,
    productCount: 0,
    orderCount: 0,
    createdAt: s.created_at,
    logo: s.logo,
  };
}

const defaultStats: SupplierStatsData = {
  total: 0,
  pending: 0,
  approved: 0,
  suspended: 0,
  todayNew: 0,
};

type TabKey = 'all' | 'pending' | 'approved' | 'suspended';

export const SupplierList: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<SupplierStatsData>(defaultStats);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await adminService.listSuppliers({ page: 1, page_size: 50 });
      const items = (result.items || []).map(transformSupplier);
      setSuppliers(items);
      const pending = items.filter((s) => s.status === 'pending').length;
      const approved = items.filter((s) => s.status === 'approved').length;
      const suspended = items.filter((s) => s.status === 'suspended').length;
      setStats({ total: result.total, pending, approved, suspended, todayNew: 0 });
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all', label: t('admin.suppliers.tabs.all'), count: stats.total },
    { key: 'pending', label: t('admin.suppliers.tabs.pending'), count: stats.pending },
    { key: 'approved', label: t('admin.suppliers.tabs.approved'), count: stats.approved },
    { key: 'suspended', label: t('admin.suppliers.tabs.suspended'), count: stats.suspended },
  ];

  const filteredSuppliers = suppliers.filter((supplier) => {
    // Filter by tab
    if (activeTab !== 'all' && supplier.status !== activeTab) {
      return false;
    }
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        supplier.name.toLowerCase().includes(query) ||
        supplier.nameEn?.toLowerCase().includes(query) ||
        supplier.contactName.toLowerCase().includes(query) ||
        supplier.contactEmail.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleView = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDetailOpen(true);
  };

  const handleApprove = async (supplier: Supplier) => {
    try {
      await adminService.approveSupplier(Number(supplier.id));
      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplier.id ? { ...s, status: 'approved' as SupplierStatus } : s))
      );
    } catch { /* ignore */ }
    setDetailOpen(false);
  };

  const handleReject = async (supplier: Supplier, reason: string) => {
    try {
      await adminService.rejectSupplier(Number(supplier.id), reason);
      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplier.id ? { ...s, status: 'rejected' as SupplierStatus } : s))
      );
    } catch { /* ignore */ }
    setDetailOpen(false);
  };

  const handleSuspend = async (supplier: Supplier, _reason: string) => {
    try {
      await adminService.suspendSupplier(Number(supplier.id));
      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplier.id ? { ...s, status: 'suspended' as SupplierStatus } : s))
      );
    } catch { /* ignore */ }
    setDetailOpen(false);
  };

  const handleUnsuspend = async (supplier: Supplier) => {
    try {
      await adminService.approveSupplier(Number(supplier.id));
      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplier.id ? { ...s, status: 'approved' as SupplierStatus } : s))
      );
    } catch { /* ignore */ }
    setDetailOpen(false);
  };

  const handleAddSupplier = () => {
    setFormMode('create');
    setSelectedSupplier(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (_data: SupplierFormData) => {
    // TODO: API call to create/update supplier when endpoint is available
    setFormOpen(false);
    loadData();
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
      <SupplierStats data={stats} loading={loading} onStatClick={handleStatClick} />

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
              placeholder={t('admin.suppliers.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Actions */}
          <button className={styles.iconBtn} onClick={loadData} title={t('common.refresh')}>
            <RefreshCw size={18} />
          </button>
          <button className={styles.iconBtn} title={t('admin.suppliers.export')}>
            <Download size={18} />
          </button>
          <button className={styles.addBtn} onClick={handleAddSupplier}>
            <Plus size={18} />
            <span>{t('admin.suppliers.add')}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <SupplierTable
        suppliers={filteredSuppliers}
        loading={loading}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        onView={handleView}
        onApprove={handleApprove}
        onReject={(s) => handleReject(s, '')}
        onSuspend={(s) => handleSuspend(s, '')}
      />

      {/* Pagination */}
      {!loading && filteredSuppliers.length > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            {t('admin.suppliers.showing', {
              from: 1,
              to: filteredSuppliers.length,
              total: filteredSuppliers.length,
            })}
          </span>
        </div>
      )}

      {/* Detail Drawer */}
      <SupplierDetail
        supplier={selectedSupplier}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onApprove={handleApprove}
        onReject={handleReject}
        onSuspend={handleSuspend}
        onUnsuspend={handleUnsuspend}
      />

      {/* Form Drawer */}
      <SupplierForm
        open={formOpen}
        mode={formMode}
        initialData={selectedSupplier || undefined}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
};

export default SupplierList;
