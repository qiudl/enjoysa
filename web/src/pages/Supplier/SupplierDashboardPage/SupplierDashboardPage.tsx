import React from 'react';
import { Header, Footer, Button } from '../../../components/Common';
import styles from './SupplierDashboardPage.module.css';

export interface SupplierDashboardPageProps {
  /** 当前语言 */
  language?: 'zh' | 'en';
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
}

const texts = {
  zh: {
    title: '供应商后台',
    welcome: '欢迎回来',
    overview: '数据概览',
    pendingOrders: '待处理订单',
    todayOrders: '今日订单',
    monthSales: '本月销售额',
    pendingSettlement: '待结算金额',
    quickActions: '快捷操作',
    productManage: '产品管理',
    orderManage: '订单管理',
    settlement: '财务结算',
    inventory: '库存管理',
    recentOrders: '最近订单',
    viewAll: '查看全部',
    orderNo: '订单号',
    product: '产品',
    customer: '客户',
    amount: '金额',
    status: '状态',
    action: '操作',
    confirm: '确认',
    productStats: '产品统计',
    totalProducts: '全部产品',
    activeProducts: '已上架',
    pendingReview: '待审核',
    supplierTypes: {
      travel_agency: '旅行社',
      hotel: '酒店',
      attraction: '景区',
      restaurant: '餐厅',
      car_rental: '租车公司',
    },
    orderStatus: {
      pending: '待处理',
      confirmed: '已确认',
      completed: '已完成',
      cancelled: '已取消',
    },
  },
  en: {
    title: 'Supplier Dashboard',
    welcome: 'Welcome back',
    overview: 'Overview',
    pendingOrders: 'Pending Orders',
    todayOrders: "Today's Orders",
    monthSales: 'Monthly Sales',
    pendingSettlement: 'Pending Settlement',
    quickActions: 'Quick Actions',
    productManage: 'Products',
    orderManage: 'Orders',
    settlement: 'Settlement',
    inventory: 'Inventory',
    recentOrders: 'Recent Orders',
    viewAll: 'View All',
    orderNo: 'Order No.',
    product: 'Product',
    customer: 'Customer',
    amount: 'Amount',
    status: 'Status',
    action: 'Action',
    confirm: 'Confirm',
    productStats: 'Product Stats',
    totalProducts: 'Total Products',
    activeProducts: 'Active',
    pendingReview: 'Pending Review',
    supplierTypes: {
      travel_agency: 'Travel Agency',
      hotel: 'Hotel',
      attraction: 'Attraction',
      restaurant: 'Restaurant',
      car_rental: 'Car Rental',
    },
    orderStatus: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled',
    },
  },
};

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
  language = 'zh',
  supplierName = '祥龙旅行社',
  supplierType = 'travel_agency',
  pendingOrders = 5,
  todayOrders = 12,
  monthSales = 28650,
  pendingSettlement = 15800,
  productCount = 24,
  activeProducts = 18,
}) => {
  const txt = texts[language];

  const stats = [
    { key: 'pending', label: txt.pendingOrders, value: pendingOrders, icon: '📋', color: '#f59e0b' },
    { key: 'today', label: txt.todayOrders, value: todayOrders, icon: '📦', color: '#3b82f6' },
    { key: 'sales', label: txt.monthSales, value: `¥${monthSales.toLocaleString()}`, icon: '💰', color: '#10b981' },
    { key: 'settlement', label: txt.pendingSettlement, value: `¥${pendingSettlement.toLocaleString()}`, icon: '🏦', color: '#8b5cf6' },
  ];

  const quickActions = [
    { key: 'products', label: txt.productManage, icon: '📦', path: '/supplier/products' },
    { key: 'orders', label: txt.orderManage, icon: '📋', path: '/supplier/orders' },
    { key: 'settlement', label: txt.settlement, icon: '💳', path: '/supplier/settlement' },
    { key: 'inventory', label: txt.inventory, icon: '📊', path: '/supplier/inventory' },
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
                {txt.welcome}, {supplierName}
              </h1>
              <p className={styles.supplierType}>
                {txt.supplierTypes[supplierType]}
              </p>
            </div>
          </section>

          {/* Stats Overview */}
          <section className={styles.statsSection}>
            <h2 className={styles.sectionTitle}>{txt.overview}</h2>
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
            <h2 className={styles.sectionTitle}>{txt.quickActions}</h2>
            <div className={styles.actionsGrid}>
              {quickActions.map((action) => (
                <button key={action.key} className={styles.actionCard}>
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
                <h2 className={styles.sectionTitle}>{txt.recentOrders}</h2>
                <button className={styles.viewAllBtn}>{txt.viewAll} →</button>
              </div>
              <div className={styles.ordersTable}>
                <div className={styles.tableHeader}>
                  <span>{txt.orderNo}</span>
                  <span>{txt.product}</span>
                  <span>{txt.customer}</span>
                  <span>{txt.amount}</span>
                  <span>{txt.status}</span>
                  <span>{txt.action}</span>
                </div>
                {mockRecentOrders.map((order) => {
                  const statusStyle = getStatusStyle(order.status);
                  return (
                    <div key={order.id} className={styles.tableRow}>
                      <span className={styles.orderId}>{order.id}</span>
                      <span className={styles.productName}>
                        {language === 'en' ? order.productEn : order.product}
                      </span>
                      <span>{order.customer}</span>
                      <span className={styles.amount}>¥{order.amount}</span>
                      <span
                        className={styles.status}
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                      >
                        {txt.orderStatus[order.status as keyof typeof txt.orderStatus]}
                      </span>
                      <span>
                        {order.status === 'pending' && (
                          <Button size="sm" variant="primary">
                            {txt.confirm}
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
              <h2 className={styles.sectionTitle}>{txt.productStats}</h2>
              <div className={styles.productStats}>
                <div className={styles.productStatItem}>
                  <span className={styles.productStatValue}>{productCount}</span>
                  <span className={styles.productStatLabel}>{txt.totalProducts}</span>
                </div>
                <div className={styles.productStatItem}>
                  <span className={styles.productStatValue} style={{ color: '#10b981' }}>
                    {activeProducts}
                  </span>
                  <span className={styles.productStatLabel}>{txt.activeProducts}</span>
                </div>
                <div className={styles.productStatItem}>
                  <span className={styles.productStatValue} style={{ color: '#f59e0b' }}>
                    {productCount - activeProducts}
                  </span>
                  <span className={styles.productStatLabel}>{txt.pendingReview}</span>
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
