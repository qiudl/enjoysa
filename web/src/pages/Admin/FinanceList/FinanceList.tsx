import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download } from 'lucide-react';
import clsx from 'clsx';
import { FinanceStats } from '../../../components/Admin/FinanceStats';
import type { FinanceStatsData } from '../../../components/Admin/FinanceStats';
import { FinanceTable } from '../../../components/Admin/FinanceTable';
import type { Settlement, SettlementStatus } from '../../../components/Admin/FinanceTable';
import { FinanceDetail } from '../../../components/Admin/FinanceDetail';
import { RevenueChart } from '../../../components/Admin/RevenueChart';
import type { RevenueData } from '../../../components/Admin/RevenueChart';
import styles from './FinanceList.module.css';

// Mock data for demonstration
const mockSettlements: Settlement[] = [
  {
    id: '1',
    settlementNo: 'STL202602010001',
    supplierId: '1',
    supplierName: '祥龙旅行社',
    period: '2026-01-01 ~ 2026-01-31',
    orderCount: 45,
    totalAmount: 12580,
    commissionRate: 15,
    commissionAmount: 1887,
    netAmount: 10693,
    status: 'pending',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: '2',
    settlementNo: 'STL202602010002',
    supplierId: '2',
    supplierName: '阳光旅游',
    period: '2026-01-01 ~ 2026-01-31',
    orderCount: 32,
    totalAmount: 8960,
    commissionRate: 12,
    commissionAmount: 1075.2,
    netAmount: 7884.8,
    status: 'processing',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: '3',
    settlementNo: 'STL202601150001',
    supplierId: '1',
    supplierName: '祥龙旅行社',
    period: '2025-12-01 ~ 2025-12-31',
    orderCount: 52,
    totalAmount: 15680,
    commissionRate: 15,
    commissionAmount: 2352,
    netAmount: 13328,
    status: 'completed',
    createdAt: '2026-01-15T00:00:00Z',
    paidAt: '2026-01-18T00:00:00Z',
  },
  {
    id: '4',
    settlementNo: 'STL202601150002',
    supplierId: '3',
    supplierName: '袋鼠岛景区',
    period: '2025-12-01 ~ 2025-12-31',
    orderCount: 128,
    totalAmount: 38400,
    commissionRate: 10,
    commissionAmount: 3840,
    netAmount: 34560,
    status: 'completed',
    createdAt: '2026-01-15T00:00:00Z',
    paidAt: '2026-01-17T00:00:00Z',
  },
  {
    id: '5',
    settlementNo: 'STL202601010001',
    supplierId: '2',
    supplierName: '阳光旅游',
    period: '2025-11-01 ~ 2025-11-30',
    orderCount: 28,
    totalAmount: 7560,
    commissionRate: 12,
    commissionAmount: 907.2,
    netAmount: 6652.8,
    status: 'completed',
    createdAt: '2026-01-01T00:00:00Z',
    paidAt: '2026-01-03T00:00:00Z',
  },
];

const mockStats: FinanceStatsData = {
  totalRevenue: 256800,
  pendingSettlement: 18577.8,
  settledAmount: 62424.6,
  commissionEarned: 38520,
  todayRevenue: 3580,
  monthRevenue: 45680,
};

const mockRevenueData: RevenueData[] = [
  { month: '2025-09', revenue: 32500 },
  { month: '2025-10', revenue: 38200 },
  { month: '2025-11', revenue: 42800 },
  { month: '2025-12', revenue: 51200 },
  { month: '2026-01', revenue: 45680 },
  { month: '2026-02', revenue: 46420 },
];

type TabKey = 'all' | 'pending' | 'processing' | 'completed';

export const FinanceList: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [stats, setStats] = useState<FinanceStatsData>(mockStats);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSettlements(mockSettlements);
    setStats(mockStats);
    setLoading(false);
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: t('admin.finance.tabs.all') },
    { key: 'pending', label: t('admin.finance.tabs.pending') },
    { key: 'processing', label: t('admin.finance.tabs.processing') },
    { key: 'completed', label: t('admin.finance.tabs.completed') },
  ];

  const filteredSettlements = settlements.filter((settlement) => {
    // Filter by tab
    if (activeTab !== 'all' && settlement.status !== activeTab) {
      return false;
    }
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        settlement.settlementNo.toLowerCase().includes(query) ||
        settlement.supplierName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleView = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setDetailOpen(true);
  };

  const handleProcess = async (settlement: Settlement) => {
    // API call to process settlement
    console.log('Process settlement:', settlement.id);
    setSettlements((prev) =>
      prev.map((s) =>
        s.id === settlement.id
          ? { ...s, status: 'processing' as SettlementStatus }
          : s
      )
    );
    setDetailOpen(false);
  };

  const handleDownload = (settlement: Settlement) => {
    // Generate and download settlement report
    console.log('Download settlement:', settlement.id);
  };

  return (
    <div className={styles.page}>
      {/* Stats */}
      <FinanceStats data={stats} loading={loading} />

      {/* Revenue Chart */}
      <div className={styles.chartSection}>
        <RevenueChart data={mockRevenueData} loading={loading} />
      </div>

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
              placeholder={t('admin.finance.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Actions */}
          <button className={styles.iconBtn} onClick={loadData} title={t('common.refresh')}>
            <RefreshCw size={18} />
          </button>
          <button className={styles.iconBtn} title={t('admin.finance.export')}>
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Table */}
      <FinanceTable
        settlements={filteredSettlements}
        loading={loading}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        onView={handleView}
        onDownload={handleDownload}
        onProcess={handleProcess}
      />

      {/* Pagination */}
      {!loading && filteredSettlements.length > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            {t('admin.finance.showing', {
              from: 1,
              to: filteredSettlements.length,
              total: filteredSettlements.length,
            })}
          </span>
        </div>
      )}

      {/* Detail Drawer */}
      <FinanceDetail
        settlement={selectedSettlement}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onProcess={handleProcess}
        onDownload={handleDownload}
      />
    </div>
  );
};

export default FinanceList;
