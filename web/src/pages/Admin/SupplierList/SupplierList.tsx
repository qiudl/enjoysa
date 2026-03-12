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
import styles from './SupplierList.module.css';

// Mock data for demonstration
const mockSuppliers: Supplier[] = [
  {
    id: '1',
    name: '祥龙旅行社',
    nameEn: 'Xianglong Travel',
    type: 'travel_agency',
    contactName: '张三',
    contactPhone: '+61 412 345 678',
    contactEmail: 'zhang@xianglong.com',
    status: 'approved',
    productCount: 15,
    orderCount: 128,
    createdAt: '2025-06-15T10:30:00Z',
    logo: '',
  },
  {
    id: '2',
    name: '阳光酒店',
    nameEn: 'Sunshine Hotel',
    type: 'hotel',
    contactName: '李四',
    contactPhone: '+61 423 456 789',
    contactEmail: 'li@sunshine.com',
    status: 'pending',
    productCount: 8,
    orderCount: 45,
    createdAt: '2026-01-20T14:20:00Z',
  },
  {
    id: '3',
    name: '袋鼠岛景区',
    nameEn: 'Kangaroo Island Scenic',
    type: 'attraction',
    contactName: '王五',
    contactPhone: '+61 434 567 890',
    contactEmail: 'wang@ki-scenic.com',
    status: 'approved',
    productCount: 6,
    orderCount: 256,
    createdAt: '2025-03-10T09:00:00Z',
  },
  {
    id: '4',
    name: '悦来餐厅',
    nameEn: 'Yue Lai Restaurant',
    type: 'restaurant',
    contactName: '赵六',
    contactPhone: '+61 445 678 901',
    contactEmail: 'zhao@yuelai.com',
    status: 'suspended',
    productCount: 3,
    orderCount: 89,
    createdAt: '2025-08-22T16:45:00Z',
  },
  {
    id: '5',
    name: '自由租车',
    nameEn: 'Freedom Car Rental',
    type: 'car_rental',
    contactName: '孙七',
    contactPhone: '+61 456 789 012',
    contactEmail: 'sun@freedom.com',
    status: 'pending',
    productCount: 12,
    orderCount: 67,
    createdAt: '2026-01-28T11:30:00Z',
  },
];

const mockStats: SupplierStatsData = {
  total: 156,
  pending: 12,
  approved: 138,
  suspended: 6,
  todayNew: 3,
};

type TabKey = 'all' | 'pending' | 'approved' | 'suspended';

export const SupplierList: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<SupplierStatsData>(mockStats);
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
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSuppliers(mockSuppliers);
    setStats(mockStats);
    setLoading(false);
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
    // API call to approve
    console.log('Approve supplier:', supplier.id);
    // Update local state
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? { ...s, status: 'approved' as SupplierStatus } : s))
    );
    setDetailOpen(false);
  };

  const handleReject = async (supplier: Supplier, reason: string) => {
    // API call to reject
    console.log('Reject supplier:', supplier.id, 'Reason:', reason);
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? { ...s, status: 'rejected' as SupplierStatus } : s))
    );
    setDetailOpen(false);
  };

  const handleSuspend = async (supplier: Supplier, reason: string) => {
    // API call to suspend
    console.log('Suspend supplier:', supplier.id, 'Reason:', reason);
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? { ...s, status: 'suspended' as SupplierStatus } : s))
    );
    setDetailOpen(false);
  };

  const handleUnsuspend = async (supplier: Supplier) => {
    // API call to unsuspend
    console.log('Unsuspend supplier:', supplier.id);
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? { ...s, status: 'approved' as SupplierStatus } : s))
    );
    setDetailOpen(false);
  };

  const handleAddSupplier = () => {
    setFormMode('create');
    setSelectedSupplier(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: SupplierFormData) => {
    console.log('Form submit:', data);
    // API call to create/update supplier
    await new Promise((resolve) => setTimeout(resolve, 1000));
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
