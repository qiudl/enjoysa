import React, { useState } from 'react';
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
  /** 当前语言 */
  language?: 'zh' | 'en';
  /** 供应商名称 */
  supplierName?: string;
  /** 待结算金额 */
  pendingAmount?: number;
  /** 已结算金额 */
  settledAmount?: number;
  /** 本月销售额 */
  monthSales?: number;
}

const texts = {
  zh: {
    title: '财务结算',
    overview: '资金概览',
    pendingSettlement: '待结算',
    settledAmount: '已结算',
    monthSales: '本月销售',
    settlementHistory: '结算记录',
    period: '结算周期',
    orderCount: '订单数',
    totalAmount: '总销售额',
    commission: '平台佣金',
    netAmount: '结算金额',
    status: '状态',
    actions: '操作',
    viewDetail: '明细',
    download: '下载',
    pending: '待结算',
    processing: '处理中',
    completed: '已结算',
    createdAt: '生成时间',
    paidAt: '打款时间',
    noSettlements: '暂无结算记录',
    commissionRate: '佣金比例',
    bankAccount: '收款账户',
    accountInfo: '账户信息',
    bankName: '开户银行',
    accountNumber: '账号',
    accountHolder: '户名',
    edit: '修改',
  },
  en: {
    title: 'Financial Settlement',
    overview: 'Financial Overview',
    pendingSettlement: 'Pending',
    settledAmount: 'Settled',
    monthSales: 'Monthly Sales',
    settlementHistory: 'Settlement History',
    period: 'Period',
    orderCount: 'Orders',
    totalAmount: 'Total Sales',
    commission: 'Commission',
    netAmount: 'Net Amount',
    status: 'Status',
    actions: 'Actions',
    viewDetail: 'Detail',
    download: 'Download',
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Settled',
    createdAt: 'Created',
    paidAt: 'Paid At',
    noSettlements: 'No settlement records',
    commissionRate: 'Commission Rate',
    bankAccount: 'Bank Account',
    accountInfo: 'Account Info',
    bankName: 'Bank',
    accountNumber: 'Account No.',
    accountHolder: 'Account Holder',
    edit: 'Edit',
  },
};

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
  language = 'zh',
  supplierName = '祥龙旅行社',
  pendingAmount = 32112,
  settledAmount = 156800,
  monthSales = 35680,
}) => {
  const txt = texts[language];
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
    const labels: Record<string, string> = {
      pending: txt.pending,
      processing: txt.processing,
      completed: txt.completed,
    };
    return labels[status] || status;
  };

  return (
    <div className={styles.page}>
      <Header isLoggedIn userName={supplierName} />

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{txt.title}</h1>
          </div>

          {/* Financial Overview */}
          <section className={styles.overviewSection}>
            <h2 className={styles.sectionTitle}>{txt.overview}</h2>
            <div className={styles.overviewGrid}>
              <div className={styles.overviewCard}>
                <div className={styles.overviewIcon} style={{ backgroundColor: '#fef3c720' }}>
                  <span>💰</span>
                </div>
                <div className={styles.overviewInfo}>
                  <span className={styles.overviewLabel}>{txt.pendingSettlement}</span>
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
                  <span className={styles.overviewLabel}>{txt.settledAmount}</span>
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
                  <span className={styles.overviewLabel}>{txt.monthSales}</span>
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
              <h2 className={styles.sectionTitle}>{txt.accountInfo}</h2>
              <Button size="sm" variant="outline">{txt.edit}</Button>
            </div>
            <div className={styles.accountCard}>
              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>{txt.bankName}</span>
                <span className={styles.accountValue}>中国建设银行 阿德莱德分行</span>
              </div>
              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>{txt.accountNumber}</span>
                <span className={styles.accountValue}>6222 **** **** 1234</span>
              </div>
              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>{txt.accountHolder}</span>
                <span className={styles.accountValue}>{supplierName}</span>
              </div>
              <div className={styles.accountRow}>
                <span className={styles.accountLabel}>{txt.commissionRate}</span>
                <span className={styles.accountValue} style={{ color: '#f59e0b' }}>10%</span>
              </div>
            </div>
          </section>

          {/* Settlement History */}
          <section className={styles.historySection}>
            <div className={styles.historyHeader}>
              <h2 className={styles.sectionTitle}>{txt.settlementHistory}</h2>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${selectedTab === 'all' ? styles.active : ''}`}
                  onClick={() => setSelectedTab('all')}
                >
                  {language === 'zh' ? '全部' : 'All'}
                </button>
                <button
                  className={`${styles.tab} ${selectedTab === 'pending' ? styles.active : ''}`}
                  onClick={() => setSelectedTab('pending')}
                >
                  {txt.pending}
                </button>
                <button
                  className={`${styles.tab} ${selectedTab === 'completed' ? styles.active : ''}`}
                  onClick={() => setSelectedTab('completed')}
                >
                  {txt.completed}
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
                          <span className={styles.periodLabel}>{txt.period}</span>
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
                          <span className={styles.statLabel}>{txt.orderCount}</span>
                          <span className={styles.statValue}>{settlement.orderCount}</span>
                        </div>
                        <div className={styles.settlementStat}>
                          <span className={styles.statLabel}>{txt.totalAmount}</span>
                          <span className={styles.statValue}>¥{settlement.totalAmount.toLocaleString()}</span>
                        </div>
                        <div className={styles.settlementStat}>
                          <span className={styles.statLabel}>{txt.commission}</span>
                          <span className={styles.statValue} style={{ color: '#ef4444' }}>
                            -¥{settlement.commission.toLocaleString()}
                          </span>
                        </div>
                        <div className={styles.settlementStat}>
                          <span className={styles.statLabel}>{txt.netAmount}</span>
                          <span className={styles.statValue} style={{ color: '#10b981', fontWeight: 700 }}>
                            ¥{settlement.netAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className={styles.settlementFooter}>
                        <div className={styles.settlementDates}>
                          <span>{txt.createdAt}: {settlement.createdAt}</span>
                          {settlement.paidAt && (
                            <span>{txt.paidAt}: {settlement.paidAt}</span>
                          )}
                        </div>
                        <div className={styles.settlementActions}>
                          <Button size="sm" variant="outline">{txt.viewDetail}</Button>
                          <Button size="sm" variant="outline">{txt.download}</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>💳</span>
                <p className={styles.emptyText}>{txt.noSettlements}</p>
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
