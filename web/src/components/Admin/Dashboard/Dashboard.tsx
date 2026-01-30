import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  TrendingUp,
  Star,
  MoreVertical,
  ArrowRight,
} from 'lucide-react';
import { StatCard } from '../StatCard';
import styles from './Dashboard.module.css';

export interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  userGrowth: number;
  totalOrders: number;
  ordersToday: number;
  orderGrowth: number;
  revenue: number;
  revenueToday: number;
  revenueGrowth: number;
  totalProducts: number;
  activeProducts: number;
  productGrowth: number;
}

export interface RecentOrder {
  id: string;
  orderNo: string;
  productName: string;
  productNameEn?: string;
  customerName: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface TopProduct {
  id: string;
  name: string;
  nameEn?: string;
  image?: string;
  sales: number;
  revenue: number;
  rating: number;
}

export interface DashboardProps {
  /** 统计数据 */
  stats?: DashboardStats;
  /** 最近订单 */
  recentOrders?: RecentOrder[];
  /** 热门产品 */
  topProducts?: TopProduct[];
  /** 加载状态 */
  loading?: boolean;
  /** 语言 */
  language?: 'zh' | 'en';
  /** 查看订单详情 */
  onViewOrder?: (order: RecentOrder) => void;
  /** 查看产品详情 */
  onViewProduct?: (product: TopProduct) => void;
  /** 查看更多订单 */
  onViewAllOrders?: () => void;
  /** 查看更多产品 */
  onViewAllProducts?: () => void;
}

const statusConfig = {
  pending: { labelZh: '待支付', labelEn: 'Pending', color: 'var(--color-warning)' },
  confirmed: { labelZh: '已确认', labelEn: 'Confirmed', color: 'var(--color-primary)' },
  completed: { labelZh: '已完成', labelEn: 'Completed', color: 'var(--color-success)' },
  cancelled: { labelZh: '已取消', labelEn: 'Cancelled', color: 'var(--color-text-muted)' },
};

const defaultStats: DashboardStats = {
  totalUsers: 0,
  newUsersToday: 0,
  userGrowth: 0,
  totalOrders: 0,
  ordersToday: 0,
  orderGrowth: 0,
  revenue: 0,
  revenueToday: 0,
  revenueGrowth: 0,
  totalProducts: 0,
  activeProducts: 0,
  productGrowth: 0,
};

export const Dashboard: React.FC<DashboardProps> = ({
  stats = defaultStats,
  recentOrders = [],
  topProducts = [],
  loading = false,
  language,
  onViewOrder,
  onViewProduct,
  onViewAllOrders,
  onViewAllProducts,
}) => {
  const { i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };

  const formatGrowth = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <div className={styles.dashboard}>
      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <StatCard
          title={isZh ? '总用户数' : 'Total Users'}
          value={stats.totalUsers.toLocaleString()}
          icon={<Users size={24} />}
          trend={stats.userGrowth >= 0 ? 'up' : 'down'}
          trendValue={formatGrowth(stats.userGrowth)}
          trendLabel={isZh ? '较上月' : 'vs last month'}
          loading={loading}
          language={language}
        />
        <StatCard
          title={isZh ? '今日订单' : 'Today Orders'}
          value={stats.ordersToday}
          icon={<ShoppingCart size={24} />}
          variant="primary"
          trend={stats.orderGrowth >= 0 ? 'up' : 'down'}
          trendValue={formatGrowth(stats.orderGrowth)}
          trendLabel={isZh ? '较昨日' : 'vs yesterday'}
          loading={loading}
          language={language}
        />
        <StatCard
          title={isZh ? '今日收入' : 'Today Revenue'}
          value={formatCurrency(stats.revenueToday)}
          icon={<DollarSign size={24} />}
          variant="success"
          trend={stats.revenueGrowth >= 0 ? 'up' : 'down'}
          trendValue={formatGrowth(stats.revenueGrowth)}
          trendLabel={isZh ? '较昨日' : 'vs yesterday'}
          loading={loading}
          language={language}
        />
        <StatCard
          title={isZh ? '在线产品' : 'Active Products'}
          value={stats.activeProducts}
          icon={<Package size={24} />}
          trend={stats.productGrowth >= 0 ? 'up' : 'down'}
          trendValue={formatGrowth(stats.productGrowth)}
          trendLabel={isZh ? '较上周' : 'vs last week'}
          loading={loading}
          language={language}
        />
      </div>

      {/* Content Grid */}
      <div className={styles.contentGrid}>
        {/* Recent Orders */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <ShoppingCart size={20} />
              {isZh ? '最近订单' : 'Recent Orders'}
            </h2>
            <button className={styles.viewAllButton} onClick={onViewAllOrders}>
              {isZh ? '查看全部' : 'View All'}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className={styles.cardContent}>
            {loading ? (
              <div className={styles.loadingList}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={styles.skeletonRow}>
                    <div className={styles.skeletonCell} style={{ width: '30%' }} />
                    <div className={styles.skeletonCell} style={{ width: '25%' }} />
                    <div className={styles.skeletonCell} style={{ width: '20%' }} />
                    <div className={styles.skeletonCell} style={{ width: '15%' }} />
                  </div>
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className={styles.emptyState}>
                <ShoppingCart size={48} strokeWidth={1} />
                <p>{isZh ? '暂无订单数据' : 'No orders yet'}</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{isZh ? '订单号' : 'Order No.'}</th>
                    <th>{isZh ? '产品' : 'Product'}</th>
                    <th>{isZh ? '金额' : 'Amount'}</th>
                    <th>{isZh ? '状态' : 'Status'}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const statusInfo = statusConfig[order.status];
                    return (
                      <tr key={order.id} onClick={() => onViewOrder?.(order)}>
                        <td className={styles.orderNo}>{order.orderNo}</td>
                        <td className={styles.productName}>
                          {isZh ? order.productName : (order.productNameEn || order.productName)}
                        </td>
                        <td className={styles.amount}>{formatCurrency(order.amount)}</td>
                        <td>
                          <span
                            className={styles.statusBadge}
                            style={{ color: statusInfo.color, backgroundColor: `${statusInfo.color}15` }}
                          >
                            {isZh ? statusInfo.labelZh : statusInfo.labelEn}
                          </span>
                        </td>
                        <td>
                          <button className={styles.actionButton}>
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <TrendingUp size={20} />
              {isZh ? '热门产品' : 'Top Products'}
            </h2>
            <button className={styles.viewAllButton} onClick={onViewAllProducts}>
              {isZh ? '查看全部' : 'View All'}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className={styles.cardContent}>
            {loading ? (
              <div className={styles.loadingList}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={styles.skeletonProduct}>
                    <div className={styles.skeletonImage} />
                    <div className={styles.skeletonInfo}>
                      <div className={styles.skeletonCell} style={{ width: '60%' }} />
                      <div className={styles.skeletonCell} style={{ width: '40%' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : topProducts.length === 0 ? (
              <div className={styles.emptyState}>
                <Package size={48} strokeWidth={1} />
                <p>{isZh ? '暂无产品数据' : 'No products yet'}</p>
              </div>
            ) : (
              <div className={styles.productList}>
                {topProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className={styles.productItem}
                    onClick={() => onViewProduct?.(product)}
                  >
                    <span className={styles.productRank}>{index + 1}</span>
                    <div className={styles.productImage}>
                      {product.image ? (
                        <img src={product.image} alt={product.name} />
                      ) : (
                        <Package size={20} />
                      )}
                    </div>
                    <div className={styles.productInfo}>
                      <h4 className={styles.productName}>
                        {isZh ? product.name : (product.nameEn || product.name)}
                      </h4>
                      <div className={styles.productMeta}>
                        <span className={styles.productSales}>
                          {isZh ? `${product.sales}销量` : `${product.sales} sold`}
                        </span>
                        <span className={styles.productRating}>
                          <Star size={12} fill="var(--color-warning)" />
                          {product.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className={styles.productRevenue}>
                      {formatCurrency(product.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
