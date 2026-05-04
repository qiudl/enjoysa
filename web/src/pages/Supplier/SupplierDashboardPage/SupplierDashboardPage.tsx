import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
const SupplierBriefing = lazy(() => import('../../../components/AI/SupplierBriefing/SupplierBriefing'));
import { Button } from '../../../components/Common';
import { get } from '../../../services/api';
import { listSupplierOrders, type Order } from '../../../services/orderService';
import {
  getRevenueTrend, getTopProducts, getChannelStats, getEnhancedStats, getScheduleAlerts,
  type RevenueTrendItem, type TopProductItem, type ChannelStatsItem, type EnhancedStats, type ScheduleAlerts,
} from '../../../services/supplierDashboardService';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import styles from './SupplierDashboardPage.module.css';

interface DashboardData {
  order_stats: {
    total: number;
    pending: number;
    paid: number;
    accepted: number;
    completed: number;
    cancelled: number;
    total_amount: number;
  };
  products: {
    total: number;
    approved: number;
    pending: number;
  };
}

export interface SupplierDashboardPageProps {
  supplierName?: string;
  supplierType?: 'travel_agency' | 'hotel' | 'attraction' | 'restaurant' | 'car_rental';
  onNavigate?: (path: string) => void;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const SupplierDashboardPage: React.FC<SupplierDashboardPageProps> = ({
  supplierName = '供应商',
  supplierType = 'travel_agency',
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [enhanced, setEnhanced] = useState<EnhancedStats | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([]);
  const [channelStats, setChannelStats] = useState<ChannelStatsItem[]>([]);
  const [alerts, setAlerts] = useState<ScheduleAlerts | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [dash, orderResult, enh, trend, top, channels, al] = await Promise.all([
          get<DashboardData>('/supplier/dashboard', 'supplier').catch(() => null),
          listSupplierOrders({ page: 1, page_size: 5 }).catch(() => ({ items: [] as never[], total: 0, page: 1, page_size: 5, total_pages: 0 })),
          getEnhancedStats().catch(() => null),
          getRevenueTrend(14).catch(() => []),
          getTopProducts(30, 5).catch(() => []),
          getChannelStats(30).catch(() => []),
          getScheduleAlerts().catch(() => null),
        ]);
        if (dash) setDashData(dash);
        setRecentOrders(orderResult?.items || []);
        setEnhanced(enh);
        setRevenueTrend(trend || []);
        setTopProducts(top || []);
        setChannelStats(channels || []);
        setAlerts(al);
      } catch {
        // Fallback: keep defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const pendingOrders = dashData?.order_stats.pending ?? 0;
  const productCount = dashData?.products.total ?? 0;
  const activeProducts = dashData?.products.approved ?? 0;

  const stats = [
    { key: 'today_revenue', label: t('supplier.dashboard.todayRevenue'), value: `$${(enhanced?.today_revenue ?? 0).toLocaleString()}`, icon: '💰', color: '#10b981' },
    { key: 'week_revenue', label: t('supplier.dashboard.weekRevenue'), value: `$${(enhanced?.week_revenue ?? 0).toLocaleString()}`, icon: '📈', color: '#3b82f6' },
    { key: 'month_revenue', label: t('supplier.dashboard.monthRevenue'), value: `$${(enhanced?.month_revenue ?? 0).toLocaleString()}`, icon: '📊', color: '#8b5cf6' },
    { key: 'pending', label: t('supplier.dashboard.pendingOrders'), value: pendingOrders, icon: '📋', color: '#f59e0b' },
    { key: 'today_orders', label: t('supplier.dashboard.todayOrders'), value: enhanced?.today_orders ?? 0, icon: '📦', color: '#06b6d4' },
    { key: 'avg_order', label: t('supplier.dashboard.avgOrderValue'), value: `$${(enhanced?.avg_order_value ?? 0).toFixed(0)}`, icon: '🎯', color: '#ec4899' },
  ];

  const quickActions = [
    { key: 'products', label: t('supplier.dashboard.productManage'), icon: '📦', path: '/supplier/products' },
    { key: 'orders', label: t('supplier.dashboard.orderManage'), icon: '📋', path: '/supplier/orders' },
    { key: 'settlement', label: t('supplier.dashboard.settlement'), icon: '💳', path: '/supplier/settlement' },
    { key: 'audit', label: t('supplier.dashboard.auditLogs'), icon: '📝', path: '/supplier/audit-logs' },
  ];

  const getStatusStyle = (status: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      pending: { bg: '#fef3c7', color: '#92400e' },
      paid: { bg: '#dbeafe', color: '#1e40af' },
      accepted: { bg: '#dbeafe', color: '#1e40af' },
      completed: { bg: '#dcfce7', color: '#166534' },
      cancelled: { bg: '#fee2e2', color: '#991b1b' },
    };
    return map[status] || map.pending;
  };

  const totalAlerts = (alerts?.low_stock?.length ?? 0) + (alerts?.sold_out?.length ?? 0);

  return (
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

          {/* AI Briefing */}
          <Suspense fallback={null}><SupplierBriefing /></Suspense>

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

          {/* Charts Section */}
          <div className={styles.chartsSection}>
            {/* Revenue Trend */}
            <section className={styles.chartCard}>
              <h2 className={styles.sectionTitle}>{t('supplier.dashboard.revenueTrend')}</h2>
              {revenueTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, t('supplier.dashboard.revenue')]} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.emptyChart}>{t('common.noData')}</div>
              )}
            </section>

            {/* Channel Distribution */}
            <section className={styles.chartCard}>
              <h2 className={styles.sectionTitle}>{t('supplier.dashboard.channelDistribution')}</h2>
              {channelStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={channelStats.map((c) => ({
                        name: c.channel === 'direct' ? t('supplier.orders.channels.direct') : c.channel === 'trip_com' ? 'Trip.com' : c.channel,
                        value: c.revenue,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {channelStats.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.emptyChart}>{t('common.noData')}</div>
              )}
            </section>
          </div>

          {/* Top Products */}
          {topProducts.length > 0 && (
            <section className={styles.topProductsSection}>
              <h2 className={styles.sectionTitle}>{t('supplier.dashboard.topProducts')}</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topProducts.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="product_name"
                    width={150}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + '...' : v}
                  />
                  <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, t('supplier.dashboard.revenue')]} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* Stock Alerts */}
          {totalAlerts > 0 && (
            <section className={styles.alertsSection}>
              <h2 className={styles.sectionTitle}>
                {t('supplier.dashboard.stockAlerts')}
                <span className={styles.alertBadge}>{totalAlerts}</span>
              </h2>
              <div className={styles.alertsList}>
                {(alerts?.sold_out || []).slice(0, 3).map((a) => (
                  <div key={a.id} className={`${styles.alertCard} ${styles.alertDanger}`}>
                    <span className={styles.alertIcon}>🔴</span>
                    <div className={styles.alertContent}>
                      <span className={styles.alertTitle}>{t('supplier.dashboard.soldOut')}</span>
                      <span className={styles.alertMeta}>{a.date} {a.time_slot}</span>
                    </div>
                  </div>
                ))}
                {(alerts?.low_stock || []).slice(0, 3).map((a) => (
                  <div key={a.id} className={`${styles.alertCard} ${styles.alertWarning}`}>
                    <span className={styles.alertIcon}>🟡</span>
                    <div className={styles.alertContent}>
                      <span className={styles.alertTitle}>{t('supplier.dashboard.lowStock')}: {a.total_slots - a.booked_slots} {t('supplier.dashboard.remaining')}</span>
                      <span className={styles.alertMeta}>{a.date} {a.time_slot}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

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
                {loading ? (
                  <div className={styles.tableRow}><span>Loading...</span></div>
                ) : recentOrders.length === 0 ? (
                  <div className={styles.tableRow}><span>{t('common.noData', 'No data')}</span></div>
                ) : recentOrders.map((order) => {
                  const statusStyle = getStatusStyle(order.status);
                  return (
                    <div key={order.id} className={styles.tableRow}>
                      <span className={styles.orderId}>{order.order_no}</span>
                      <span className={styles.productName}>
                        {order.product_name}
                      </span>
                      <span>{order.contact_name}</span>
                      <span className={styles.amount}>${order.total_price}</span>
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
  );
};

export default SupplierDashboardPage;
