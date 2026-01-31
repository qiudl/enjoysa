import React from 'react';
import { useTranslation } from 'react-i18next';
import { Header, Footer, Button } from '../../../components/Common';
import styles from './SupplierDashboardPage.module.css';

export interface SupplierDashboardPageProps {
  /** 供应商名称 */
  supplierName?: string;
  /** 供应商类型 */
  supplierType?: 'travel_agency' | 'hotel' | 'attraction' | 'restaurant' | 'car_rental';
  /** 待处理订单数 */
  pendingOrders?: number;
  /** 今日订单数 */
  todayOrders?: number;
  /** 本月销售额 */
  monthSales?: number;
  /** 待结算金额 */
  pendingSettlement?: number;
  /** 产品数量 */
  productCount?: number;
  /** 上架产品数 */
  activeProducts?: number;
  /** 导航到指定路径 */
  onNavigate?: (path: string) => void;
}

// Mock recent orders
const mockRecentOrders = [
  {
    id: 'ORD-20260130-0001',
    product: '袋鼠岛一日游',
    productEn: 'Kangaroo Island Day Tour',
    customer: '张三',
    amount: 778,
    status: 'pending',
    date: '2026-01-30',
  },
  {
    id: 'ORD-20260130-0002',
    product: '巴罗莎谷酒庄之旅',
    productEn: 'Barossa Valley Winery Tour',
    customer: '李四',
    amount: 1196,
    status: 'confirmed',
    date: '2026-01-30',
  },
  {
    id: 'ORD-20260129-0003',
    product: '阿德莱德市区观光',
    productEn: 'Adelaide City Tour',
    customer: 'John Doe',
    amount: 299,
    status: 'completed',
    date: '2026-01-29',
  },
];

export const SupplierDashboardPage: React.FC<SupplierDashboardPageProps> = ({
  supplierName = '祥龙旅行社',
  supplierType = 'travel_agency',
  pendingOrders = 5,
  todayOrders = 12,
  monthSales = 28650,
  pendingSettlement = 15800,
  productCount = 24,
  activeProducts = 18,
  onNavigate,
}) => {
  const { t } = useTranslation();

  const stats = [
    { key: 'pending', label: t('supplier.dashboard.pendingOrders'), value: pendingOrders, icon: '📋', color: '#f59e0b' },
    { key: 'today', label: t('supplier.dashboard.todayOrders'), value: todayOrders, icon: '📦', color: '#3b82f6' },
    { key: 'sales', label: t('supplier.dashboard.monthSales'), value: `¥${monthSales.toLocaleString()}`, icon: '💰', color: '#10b981' },
    { key: 'settlement', label: t('supplier.dashboard.pendingSettlement'), value: `¥${pendingSettlement.toLocaleString()}`, icon: '🏦', color: '#8b5cf6' },
  ];

  const quickActions = [
    { key: 'products', label: t('supplier.dashboard.productManage'), icon: '📦', path: '/supplier/products' },
    { key: 'orders', label: t('supplier.dashboard.orderManage'), icon: '📋', path: '/supplier/orders' },
    { key: 'settlement', label: t('supplier.dashboard.settlement'), icon: '💳', path: '/supplier/settlement' },
  ];

  const getStatusStyle = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      pending: { bg: '#fef3c7', color: '#92400e' },
      confirmed: { bg: '#dbeafe', color: '#1e40af' },
      completed: { bg: '#dcfce7', color: '#166534' },
      cancelled: { bg: '#fee2e2', color: '#991b1b' },
    };
    return styles[status] || styles.pending;
  };

  return (
    <div className={styles.page}>
      <Header isLoggedIn userName={supplierName} />

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Welcome Section */}
          <section className={styles.welcomeSection}>
            <div className={styles.welcomeContent}>
              <h1 className={styles.welcomeTitle}>
                {t('supplier.dashboard.welcome')}, {supplierName}
              </h1>
              <p className={styles.supplierType}>
                {t(`supplier.types.${supplierType}`)}
              </p>
            </div>
          </section>

          {/* Stats Overview */}
          <section className={styles.statsSection}>
            <h2 className={styles.sectionTitle}>{t('supplier.dashboard.overview')}</h2>
            <div className={styles.statsGrid}>
              {stats.map((stat) => (
                <div key={stat.key} className={styles.statCard}>
                  <div className={styles.statIcon} style={{ backgroundColor: `${stat.color}20` }}>
                    <span>{stat.icon}</span>
                  </div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue} style={{ color: stat.color }}>
                      {stat.value}
                    </span>
                    <span className={styles.statLabel}>{stat.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section className={styles.actionsSection}>
            <h2 className={styles.sectionTitle}>{t('supplier.dashboard.quickActions')}</h2>
            <div className={styles.actionsGrid}>
              {quickActions.map((action) => (
                <button
                  key={action.key}
                  className={styles.actionCard}
                  onClick={() => onNavigate?.(action.path)}
                >
                  <span className={styles.actionIcon}>{action.icon}</span>
                  <span className={styles.actionLabel}>{action.label}</span>
                </button>
              ))}
            </div>
          </section>

          <div className={styles.bottomSection}>
            {/* Recent Orders */}
            <section className={styles.ordersSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>{t('supplier.dashboard.recentOrders')}</h2>
                <button
                  className={styles.viewAllBtn}
                  onClick={() => onNavigate?.('/supplier/orders')}
                >
                  {t('supplier.dashboard.viewAll')} →
                </button>
              </div>
              <div className={styles.ordersTable}>
                <div className={styles.tableHeader}>
                  <span>{t('supplier.dashboard.orderNo')}</span>
                  <span>{t('supplier.dashboard.product')}</span>
                  <span>{t('supplier.dashboard.customer')}</span>
                  <span>{t('supplier.dashboard.amount')}</span>
                  <span>{t('supplier.dashboard.status')}</span>
                  <span>{t('supplier.dashboard.action')}</span>
                </div>
                {mockRecentOrders.map((order) => {
                  const statusStyle = getStatusStyle(order.status);
                  return (
                    <div key={order.id} className={styles.tableRow}>
                      <span className={styles.orderId}>{order.id}</span>
                      <span className={styles.productName}>
                        {order.product}
                      </span>
                      <span>{order.customer}</span>
                      <span className={styles.amount}>¥{order.amount}</span>
                      <span
                        className={styles.status}
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                      >
                        {t(`supplier.dashboard.orderStatus.${order.status}`)}
                      </span>
                      <span>
                        {order.status === 'pending' && (
                          <Button size="sm" variant="primary">
                            {t('supplier.dashboard.confirm')}
                          </Button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Product Stats */}
            <section className={styles.productStatsSection}>
              <h2 className={styles.sectionTitle}>{t('supplier.dashboard.productStats')}</h2>
              <div className={styles.productStats}>
                <div className={styles.productStatItem}>
                  <span className={styles.productStatValue}>{productCount}</span>
                  <span className={styles.productStatLabel}>{t('supplier.dashboard.totalProducts')}</span>
                </div>
                <div className={styles.productStatItem}>
                  <span className={styles.productStatValue} style={{ color: '#10b981' }}>
                    {activeProducts}
                  </span>
                  <span className={styles.productStatLabel}>{t('supplier.dashboard.activeProducts')}</span>
                </div>
                <div className={styles.productStatItem}>
                  <span className={styles.productStatValue} style={{ color: '#f59e0b' }}>
                    {productCount - activeProducts}
                  </span>
                  <span className={styles.productStatLabel}>{t('supplier.dashboard.pendingReview')}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SupplierDashboardPage;
