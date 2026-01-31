import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header, Footer, Button } from '../../../components/Common';
import styles from './SupplierSettlementPage.module.css';

export interface Settlement {
  id: string;
  period: string;
  orderCount: number;
  totalAmount: number;
  commission: number;
  netAmount: number;
  status: 'pending' | 'processing' | 'completed';
  createdAt: string;
  paidAt?: string;
}

export interface SupplierSettlementPageProps {
  /** 供应商名称 */
  supplierName?: string;
  /** 待结算金额 */
  pendingAmount?: number;
  /** 已结算金额 */
  settledAmount?: number;
  /** 本月销售额 */
  monthSales?: number;
  /** 导航回调 */
  onNavigate?: (path: string) => void;
}

// Mock settlements
const mockSettlements: Settlement[] = [
  {
    id: 'STL-202601-001',
    period: '2026年1月上半月',
    orderCount: 45,
    totalAmount: 35680,
    commission: 3568,
    netAmount: 32112,
    status: 'pending',
    createdAt: '2026-01-16',
  },
  {
    id: 'STL-202512-002',
    period: '2025年12月下半月',
    orderCount: 62,
    totalAmount: 48920,
    commission: 4892,
    netAmount: 44028,
    status: 'completed',
    createdAt: '2026-01-01',
    paidAt: '2026-01-05',
  },
  {
    id: 'STL-202512-001',
    period: '2025年12月上半月',
    orderCount: 38,
    totalAmount: 29500,
    commission: 2950,
    netAmount: 26550,
    status: 'completed',
    createdAt: '2025-12-16',
    paidAt: '2025-12-20',
  },
];

export const SupplierSettlementPage: React.FC<SupplierSettlementPageProps> = ({
  supplierName = '祥龙旅行社',
  pendingAmount = 32112,
  settledAmount = 156800,
  monthSales = 35680,
}) => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<'all' | 'pending' | 'completed'>('all');

  const filteredSettlements = mockSettlements.filter((s) => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'pending') return s.status === 'pending' || s.status === 'processing';
    return s.status === 'completed';
  });

  const getStatusStyle = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      pending: { bg: '#fef3c7', color: '#92400e' },
      processing: { bg: '#dbeafe', color: '#1e40af' },
      completed: { bg: '#dcfce7', color: '#166534' },
    };
    return styles[status] || styles.pending;
  };

  const getStatusLabel = (status: string) => {
    return t(`supplier.settlement.${status}`);
  };

  return (
    <div className={styles.page}>
      <Header isLoggedIn userName={supplierName} />

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{t('supplier.settlement.title')}</h1>
          </div>

          {/* Financial Overview */}
          <section className={styles.overviewSection}>
            <h2 className={styles.sectionTitle}>{t('supplier.settlement.overview')}</h2>
            <div className={styles.overviewGrid}>
              <div className={styles.overviewCard}>
                <div className={styles.overviewIcon} style={{ backgroundColor: '#fef3c720' }}>
                  <span>💰</span>
                </div>
                <div className={styles.overviewInfo}>
                  <span className={styles.overviewLabel}>{t('supplier.settlement.pendingSettlement')}</span>
                  <span className={styles.overviewValue} style={{ color: '#f59e0b' }}>
                    ¥{pendingAmount.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className={styles.overviewCard}>
                <div className={styles.overviewIcon} style={{ backgroundColor: '#dcfce720' }}>
                  <span>✅</span>
                </div>
                <div className={styles.overviewInfo}>
                  <span className={styles.overviewLabel}>{t('supplier.settlement.settledAmount')}</span>
                  <span className={styles.overviewValue} style={{ color: '#10b981' }}>
                    ¥{settledAmount.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className={styles.overviewCard}>
                <div className={styles.overviewIcon} style={{ backgroundColor: '#dbeafe20' }}>
                  <span>📊</span>
                </div>
                <div className={styles.overviewInfo}>
                  <span className={styles.overviewLabel}>{t('supplier.settlement.monthSales')}</span>
                  <span className={styles.overviewValue} style={{ color: '#3b82f6' }}>
                    ¥{monthSales.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Bank Account Info */}
          <section className={styles.accountSection}>
            <div className={styles.accountHeader}>
              <h2 className={styles.sectionTitle}>{t('supplier.settlement.accountInfo')}</h2>
              <Button size="sm" variant="outline">{t('supplier.settlement.edit')}</Button>
            </div>
            <div className={styles.accountCard}>
              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>{t('supplier.settlement.bankName')}</span>
                <span className={styles.accountValue}>中国建设银行 阿德莱德分行</span>
              </div>
              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>{t('supplier.settlement.accountNumber')}</span>
                <span className={styles.accountValue}>6222 **** **** 1234</span>
              </div>
              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>{t('supplier.settlement.accountHolder')}</span>
                <span className={styles.accountValue}>{supplierName}</span>
              </div>
              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>{t('supplier.settlement.commissionRate')}</span>
                <span className={styles.accountValue} style={{ color: '#f59e0b' }}>10%</span>
              </div>
            </div>
          </section>

          {/* Settlement History */}
          <section className={styles.historySection}>
            <div className={styles.historyHeader}>
              <h2 className={styles.sectionTitle}>{t('supplier.settlement.settlementHistory')}</h2>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${selectedTab === 'all' ? styles.active : ''}`}
                  onClick={() => setSelectedTab('all')}
                >
                  {t('supplier.settlement.all')}
                </button>
                <button
                  className={`${styles.tab} ${selectedTab === 'pending' ? styles.active : ''}`}
                  onClick={() => setSelectedTab('pending')}
                >
                  {t('supplier.settlement.pending')}
                </button>
                <button
                  className={`${styles.tab} ${selectedTab === 'completed' ? styles.active : ''}`}
                  onClick={() => setSelectedTab('completed')}
                >
                  {t('supplier.settlement.completed')}
                </button>
              </div>
            </div>

            {filteredSettlements.length > 0 ? (
              <div className={styles.settlementList}>
                {filteredSettlements.map((settlement) => {
                  const statusStyle = getStatusStyle(settlement.status);
                  return (
                    <div key={settlement.id} className={styles.settlementCard}>
                      <div className={styles.settlementHeader}>
                        <div className={styles.settlementPeriod}>
                          <span className={styles.periodLabel}>{t('supplier.settlement.period')}</span>
                          <span className={styles.periodValue}>{settlement.period}</span>
                        </div>
                        <span
                          className={styles.settlementStatus}
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                        >
                          {getStatusLabel(settlement.status)}
                        </span>
                      </div>
                      <div className={styles.settlementBody}>
                        <div className={styles.settlementStat}>
                          <span className={styles.statLabel}>{t('supplier.settlement.orderCount')}</span>
                          <span className={styles.statValue}>{settlement.orderCount}</span>
                        </div>
                        <div className={styles.settlementStat}>
                          <span className={styles.statLabel}>{t('supplier.settlement.totalAmount')}</span>
                          <span className={styles.statValue}>¥{settlement.totalAmount.toLocaleString()}</span>
                        </div>
                        <div className={styles.settlementStat}>
                          <span className={styles.statLabel}>{t('supplier.settlement.commission')}</span>
                          <span className={styles.statValue} style={{ color: '#ef4444' }}>
                            -¥{settlement.commission.toLocaleString()}
                          </span>
                        </div>
                        <div className={styles.settlementStat}>
                          <span className={styles.statLabel}>{t('supplier.settlement.netAmount')}</span>
                          <span className={styles.statValue} style={{ color: '#10b981', fontWeight: 700 }}>
                            ¥{settlement.netAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className={styles.settlementFooter}>
                        <div className={styles.settlementDates}>
                          <span>{t('supplier.settlement.createdAt')}: {settlement.createdAt}</span>
                          {settlement.paidAt && (
                            <span>{t('supplier.settlement.paidAt')}: {settlement.paidAt}</span>
                          )}
                        </div>
                        <div className={styles.settlementActions}>
                          <Button size="sm" variant="outline">{t('supplier.settlement.viewDetail')}</Button>
                          <Button size="sm" variant="outline">{t('supplier.settlement.download')}</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>💳</span>
                <p className={styles.emptyText}>{t('supplier.settlement.noSettlements')}</p>
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SupplierSettlementPage;
