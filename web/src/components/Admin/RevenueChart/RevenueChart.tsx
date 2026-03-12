import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react';
import styles from './RevenueChart.module.css';

export interface RevenueData {
  month: string;
  revenue: number;
}

export interface RevenueChartProps {
  data: RevenueData[];
  loading?: boolean;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data, loading }) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.skeleton} style={{ width: 120, height: 20 }} />
        </div>
        <div className={styles.chartSkeleton}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={styles.barSkeleton} style={{ height: `${Math.random() * 60 + 20}%` }} />
          ))}
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue));

  const formatRevenue = (value: number) => {
    if (value >= 10000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toFixed(0);
  };

  const formatMonth = (month: string) => {
    const date = new Date(month + '-01');
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { month: 'short' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <TrendingUp size={18} />
          <h3 className={styles.title}>
            {isZh ? '收入趋势' : 'Revenue Trend'}
          </h3>
        </div>
        <span className={styles.period}>
          {isZh ? '近6个月' : 'Last 6 months'}
        </span>
      </div>

      <div className={styles.chart}>
        <div className={styles.bars}>
          {data.map((item, index) => {
            const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
            return (
              <div key={index} className={styles.barContainer}>
                <div className={styles.barValue}>A${formatRevenue(item.revenue)}</div>
                <div className={styles.barWrapper}>
                  <div
                    className={styles.bar}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <div className={styles.barLabel}>{formatMonth(item.month)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RevenueChart;
