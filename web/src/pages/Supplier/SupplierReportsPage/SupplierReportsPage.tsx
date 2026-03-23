import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, ShoppingCart, DollarSign, BarChart3 } from 'lucide-react';
import styles from './SupplierReportsPage.module.css';

export interface SupplierReportsPageProps {
  onNavigate?: (path: string) => void;
}

type DateRange = '7d' | '30d' | '90d';

interface DailyData {
  date: string;
  revenue: number;
  orders: number;
}

interface ProductRank {
  name: string;
  nameEn: string;
  revenue: number;
  orders: number;
}

const mockData: Record<DateRange, DailyData[]> = {
  '7d': [
    { date: '03/17', revenue: 1240, orders: 8 },
    { date: '03/18', revenue: 890, orders: 5 },
    { date: '03/19', revenue: 1560, orders: 11 },
    { date: '03/20', revenue: 720, orders: 4 },
    { date: '03/21', revenue: 2100, orders: 14 },
    { date: '03/22', revenue: 1890, orders: 12 },
    { date: '03/23', revenue: 1350, orders: 9 },
  ],
  '30d': [
    { date: '02/22', revenue: 3200, orders: 22 },
    { date: '02/25', revenue: 2800, orders: 18 },
    { date: '03/01', revenue: 4100, orders: 28 },
    { date: '03/05', revenue: 3600, orders: 24 },
    { date: '03/10', revenue: 5200, orders: 35 },
    { date: '03/15', revenue: 4800, orders: 31 },
    { date: '03/20', revenue: 3900, orders: 26 },
    { date: '03/23', revenue: 4500, orders: 30 },
  ],
  '90d': [
    { date: '01月', revenue: 28000, orders: 180 },
    { date: '02月', revenue: 35000, orders: 230 },
    { date: '03月', revenue: 42000, orders: 285 },
  ],
};

const mockProducts: ProductRank[] = [
  { name: '袋鼠岛一日游', nameEn: 'Kangaroo Island Day Tour', revenue: 12600, orders: 42 },
  { name: '巴罗萨谷品酒之旅', nameEn: 'Barossa Valley Wine Tour', revenue: 9800, orders: 35 },
  { name: '阿德莱德城市观光', nameEn: 'Adelaide City Sightseeing', revenue: 7200, orders: 48 },
  { name: '维克多港企鹅观赏', nameEn: 'Victor Harbor Penguin Tour', revenue: 5600, orders: 28 },
  { name: '格雷内尔格日落之旅', nameEn: 'Glenelg Sunset Tour', revenue: 3400, orders: 22 },
];

export const SupplierReportsPage: React.FC<SupplierReportsPageProps> = () => {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<DateRange>('7d');

  const data = mockData[range];
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const conversionRate = 3.8;

  const maxRevenue = Math.max(...data.map((d) => d.revenue));
  const maxOrders = Math.max(...data.map((d) => d.orders));
  const topProductRevenue = mockProducts[0]?.revenue || 1;

  const ranges: { key: DateRange; labelKey: string }[] = [
    { key: '7d', labelKey: 'supplier.reports.range7d' },
    { key: '30d', labelKey: 'supplier.reports.range30d' },
    { key: '90d', labelKey: 'supplier.reports.range90d' },
  ];

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
            <span className={styles.statValue}>{conversionRate}%</span>
            <span className={styles.statLabel}>{t('supplier.reports.conversionRate')}</span>
          </div>
        </div>
      </div>

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
                <span className={styles.barLabel}>{d.date}</span>
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
                      height: `${(d.orders / maxOrders) * 100}%`,
                      background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                    }}
                  >
                    <span className={styles.barValue}>{d.orders}</span>
                  </div>
                </div>
                <span className={styles.barLabel}>{d.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Product Ranking */}
      <div className={styles.rankCard}>
        <h3 className={styles.chartTitle}>{t('supplier.reports.productRanking')}</h3>
        <div className={styles.rankList}>
          {mockProducts.map((p, i) => (
            <div key={i} className={styles.rankItem}>
              <div className={styles.rankIndex}>
                <span className={`${styles.rankBadge} ${i < 3 ? styles[`rank${i + 1}`] : ''}`}>
                  {i + 1}
                </span>
              </div>
              <div className={styles.rankInfo}>
                <span className={styles.rankName}>
                  {i18n.language === 'en' ? p.nameEn : p.name}
                </span>
                <span className={styles.rankMeta}>
                  {p.orders} {t('supplier.reports.orderUnit')} · AUD ${p.revenue.toLocaleString()}
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
    </div>
  );
};

export default SupplierReportsPage;
