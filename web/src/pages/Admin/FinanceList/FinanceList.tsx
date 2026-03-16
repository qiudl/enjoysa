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
import { get, post } from '../../../services/api';
import type { PaginatedResponse } from '../../../services/api';
import styles from './FinanceList.module.css';

interface ApiSettlement {
  id: number;
  settlement_no: string;
  supplier_id: number;
  supplier_name: string;
  period_start: string;
  period_end: string;
  order_count: number;
  gross_amount: number;
  commission: number;
  net_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ApiFinanceStats {
  total_revenue: number;
  pending_amount: number;
  settled_amount: number;
  commission_earned: number;
  today_revenue: number;
  month_revenue: number;
}

function transformSettlement(s: ApiSettlement): Settlement {
  return {
    id: String(s.id),
    settlementNo: s.settlement_no,
    supplierId: String(s.supplier_id),
    supplierName: s.supplier_name,
    period: `${s.period_start} ~ ${s.period_end}`,
    orderCount: s.order_count,
    totalAmount: s.gross_amount,
    commissionRate: s.gross_amount > 0 ? Math.round((s.commission / s.gross_amount) * 100) : 0,
    commissionAmount: s.commission,
    netAmount: s.net_amount,
    status: (s.status || 'pending') as SettlementStatus,
    createdAt: s.created_at,
    paidAt: undefined,
  };
}

function transformStats(s: ApiFinanceStats): FinanceStatsData {
  return {
    totalRevenue: s.total_revenue || 0,
    pendingSettlement: s.pending_amount || 0,
    settledAmount: s.settled_amount || 0,
    commissionEarned: s.commission_earned || 0,
    todayRevenue: s.today_revenue || 0,
    monthRevenue: s.month_revenue || 0,
  };
}

const defaultStats: FinanceStatsData = {
  totalRevenue: 0,
  pendingSettlement: 0,
  settledAmount: 0,
  commissionEarned: 0,
  todayRevenue: 0,
  monthRevenue: 0,
};

const defaultRevenueData: RevenueData[] = [];

type TabKey = 'all' | 'pending' | 'processing' | 'completed';

export const FinanceList: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [stats, setStats] = useState<FinanceStatsData>(defaultStats);
  const [revenueData] = useState<RevenueData[]>(defaultRevenueData);
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
    try {
      const [settlementsResult, statsResult] = await Promise.all([
        get<PaginatedResponse<ApiSettlement>>('/admin/settlements?page=1&page_size=50', 'admin'),
        get<ApiFinanceStats>('/admin/settlements/stats', 'admin'),
      ]);
      setSettlements(settlementsResult.items.map(transformSettlement));
      setStats(transformStats(statsResult));
    } catch {
      // keep defaults on error
    } finally {
      setLoading(false);
    }
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
    try {
      await post(`/admin/settlements/${settlement.id}/process`, { status: 'processing' }, 'admin');
      setSettlements((prev) =>
        prev.map((s) =>
          s.id === settlement.id
            ? { ...s, status: 'processing' as SettlementStatus }
            : s
        )
      );
      setDetailOpen(false);
    } catch {
      // handle error
    }
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
        <RevenueChart data={revenueData} loading={loading} />
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
