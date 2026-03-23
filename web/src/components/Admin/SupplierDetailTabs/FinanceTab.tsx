import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Clock, CheckCircle } from 'lucide-react';
import { adminService, type ApiSettlementStats, type ApiSettlement } from '../../../services/adminService';
import styles from '../../../pages/Admin/SupplierDetailPage/SupplierDetailPage.module.css';

interface FinanceTabProps {
  supplierId: number;
}

export const FinanceTab: React.FC<FinanceTabProps> = ({ supplierId }) => {
  const { t } = useTranslation();

  const [settlementStats, setSettlementStats] = useState<ApiSettlementStats | null>(null);
  const [settlements, setSettlements] = useState<ApiSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, settlementsRes] = await Promise.all([
        adminService.getSupplierSettlementStats(supplierId),
        adminService.getSupplierSettlements(supplierId, { page, page_size: 10 }),
      ]);
      setSettlementStats(statsRes);
      setSettlements(settlementsRes.items || []);
      setTotalPages(settlementsRes.total_pages || 1);
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supplierId, page]);

  const pendingAmount = settlementStats?.pending_amount || 0;
  const completedAmount = settlementStats?.completed_amount || 0;
  const totalAmount = pendingAmount + completedAmount;

  const statCards = [
    {
      label: t('admin.suppliers.detail.finance.pending'),
      value: `$${pendingAmount.toFixed(2)}`,
      icon: <Clock size={20} />,
    },
    {
      label: t('admin.suppliers.detail.finance.completed'),
      value: `$${completedAmount.toFixed(2)}`,
      icon: <CheckCircle size={20} />,
    },
    {
      label: t('admin.suppliers.detail.finance.total'),
      value: `$${totalAmount.toFixed(2)}`,
      icon: <DollarSign size={20} />,
    },
  ];

  return (
    <div>
      {/* Stat Cards */}
      <div className={styles.statsGrid}>
        {statCards.map((card, idx) => (
          <div key={idx} className={styles.statCard}>
            <div className={styles.statLabel}>{card.label}</div>
            <div className={styles.statValue}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Settlement Records Table */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t('admin.suppliers.detail.finance.records')}
        </h3>
        {loading ? (
          <div className={styles.empty}>{t('common.loading')}</div>
        ) : settlements.length === 0 ? (
          <div className={styles.empty}>{t('admin.suppliers.detail.finance.noRecords')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.suppliers.detail.finance.id')}</th>
                <th>{t('admin.suppliers.detail.finance.orderId')}</th>
                <th>{t('admin.suppliers.detail.finance.grossAmount')}</th>
                <th>{t('admin.suppliers.detail.finance.commission')}</th>
                <th>{t('admin.suppliers.detail.finance.netAmount')}</th>
                <th>{t('admin.suppliers.detail.finance.status')}</th>
                <th>{t('admin.suppliers.detail.finance.date')}</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id}>
                  <td>#{s.id}</td>
                  <td>#{s.order_id}</td>
                  <td>${s.gross_amount.toFixed(2)}</td>
                  <td>
                    ${s.commission_amount.toFixed(2)}
                    <small style={{ color: '#6b7280', marginLeft: 4 }}>
                      ({(s.commission_rate * 100).toFixed(0)}%)
                    </small>
                  </td>
                  <td>${s.net_amount.toFixed(2)}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[s.status] || ''}`}>
                      {t(`admin.suppliers.detail.finance.statusLabel.${s.status}`, s.status)}
                    </span>
                  </td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
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
    </div>
  );
};

export default FinanceTab;
