import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, ShoppingCart, DollarSign, BarChart3, Loader2 } from 'lucide-react';
import {
  getRevenueTrend,
  getTopProducts,
  type RevenueTrendItem,
  type TopProductItem,
} from '../../../services/supplierDashboardService';
import styles from './SupplierReportsPage.module.css';

export interface SupplierReportsPageProps {
  onNavigate?: (path: string) => void;
}

type DateRange = '7d' | '30d' | '90d';

const RANGE_DAYS: Record<DateRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

export const SupplierReportsPage: React.FC<SupplierReportsPageProps> = () => {
  const { t } = useTranslation();
  const [range, setRange] = useState<DateRange>('7d');
  const [data, setData] = useState<RevenueTrendItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const days = RANGE_DAYS[range];
    Promise.all([
      getRevenueTrend(days).catch(() => [] as RevenueTrendItem[]),
      getTopProducts(days, 5).catch(() => [] as TopProductItem[]),
    ]).then(([trend, products]) => {
      setData(trend);
      setTopProducts(products);
    }).finally(() => setLoading(false));
  }, [range]);

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = data.reduce((s, d) => s + d.order_count, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const maxOrders = Math.max(...data.map((d) => d.order_count), 1);
  const topProductRevenue = topProducts[0]?.revenue || 1;

  const ranges: { key: DateRange; labelKey: string }[] = [
    { key: '7d', labelKey: 'supplier.reports.range7d' },
    { key: '30d', labelKey: 'supplier.reports.range30d' },
    { key: '90d', labelKey: 'supplier.reports.range90d' },
  ];

  /* Format date label for chart display */
  const formatDateLabel = (dateStr: string) => {
    // dateStr is YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}`;
    }
    return dateStr;
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('supplier.reports.title')}</h1>
        <div className={styles.rangeSelector}>
          {ranges.map((r) => (
            <button
              key={r.key}
              className={`${styles.rangeBtn} ${range === r.key ? styles.active : ''}`}
              onClick={() => setRange(r.key)}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#ecfdf5', color: '#10b981' }}>
            <DollarSign size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>AUD ${totalRevenue.toLocaleString()}</span>
            <span className={styles.statLabel}>{t('supplier.reports.totalRevenue')}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#dbeafe', color: '#3b82f6' }}>
            <ShoppingCart size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{totalOrders}</span>
            <span className={styles.statLabel}>{t('supplier.reports.totalOrders')}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#fef3c7', color: '#d97706' }}>
            <TrendingUp size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>AUD ${avgOrderValue.toFixed(0)}</span>
            <span className={styles.statLabel}>{t('supplier.reports.avgOrderValue')}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#ede9fe', color: '#7c3aed' }}>
            <BarChart3 size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{data.length}</span>
            <span className={styles.statLabel}>{t('supplier.reports.activeDays', 'Active Days')}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#64748b' }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
          {t('common.noData', 'No data for this period')}
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className={styles.chartsRow}>
            {/* Revenue Trend */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>{t('supplier.reports.revenueTrend')}</h3>
              <div className={styles.barChart}>
                {data.map((d, i) => (
                  <div key={i} className={styles.barGroup}>
                    <div className={styles.barWrapper}>
                      <div
                        className={styles.bar}
                        style={{
                          height: `${(d.revenue / maxRevenue) * 100}%`,
                          background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                        }}
                      >
                        <span className={styles.barValue}>${d.revenue}</span>
                      </div>
                    </div>
                    <span className={styles.barLabel}>{formatDateLabel(d.date)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Orders Chart */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>{t('supplier.reports.ordersChart')}</h3>
              <div className={styles.barChart}>
                {data.map((d, i) => (
                  <div key={i} className={styles.barGroup}>
                    <div className={styles.barWrapper}>
                      <div
                        className={styles.bar}
                        style={{
                          height: `${(d.order_count / maxOrders) * 100}%`,
                          background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                        }}
                      >
                        <span className={styles.barValue}>{d.order_count}</span>
                      </div>
                    </div>
                    <span className={styles.barLabel}>{formatDateLabel(d.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Product Ranking */}
          {topProducts.length > 0 && (
            <div className={styles.rankCard}>
              <h3 className={styles.chartTitle}>{t('supplier.reports.productRanking')}</h3>
              <div className={styles.rankList}>
                {topProducts.map((p, i) => (
                  <div key={p.product_id} className={styles.rankItem}>
                    <div className={styles.rankIndex}>
                      <span className={`${styles.rankBadge} ${i < 3 ? styles[`rank${i + 1}`] : ''}`}>
                        {i + 1}
                      </span>
                    </div>
                    <div className={styles.rankInfo}>
                      <span className={styles.rankName}>
                        {p.product_name}
                      </span>
                      <span className={styles.rankMeta}>
                        {p.order_count} {t('supplier.reports.orderUnit')} · AUD ${p.revenue.toLocaleString()}
                      </span>
                    </div>
                    <div className={styles.rankBar}>
                      <div
                        className={styles.rankBarFill}
                        style={{ width: `${(p.revenue / topProductRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SupplierReportsPage;
