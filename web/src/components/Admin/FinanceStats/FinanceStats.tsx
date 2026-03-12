import React from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Clock, TrendingUp, ArrowUpRight } from 'lucide-react';
import styles from './FinanceStats.module.css';

export interface FinanceStatsData {
  totalRevenue: number;
  pendingSettlement: number;
  settledAmount: number;
  commissionEarned: number;
  todayRevenue?: number;
  monthRevenue?: number;
}

export interface FinanceStatsProps {
  data: FinanceStatsData;
  loading?: boolean;
  onStatClick?: (type: string) => void;
}

export const FinanceStats: React.FC<FinanceStatsProps> = ({
  data,
  loading = false,
  onStatClick,
}) => {
  const { t } = useTranslation();

  const formatPrice = (price: number) => {
    return `A$${price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const stats = [
    {
      key: 'totalRevenue',
      label: t('admin.finance.stats.totalRevenue'),
      value: formatPrice(data.totalRevenue),
      icon: <DollarSign size={20} />,
      color: '#10b981',
      bgColor: '#d1fae5',
      subtext: data.todayRevenue ? `${t('admin.finance.stats.today')} ${formatPrice(data.todayRevenue)}` : undefined,
    },
    {
      key: 'pendingSettlement',
      label: t('admin.finance.stats.pendingSettlement'),
      value: formatPrice(data.pendingSettlement),
      icon: <Clock size={20} />,
      color: '#f59e0b',
      bgColor: '#fef3c7',
    },
    {
      key: 'settledAmount',
      label: t('admin.finance.stats.settledAmount'),
      value: formatPrice(data.settledAmount),
      icon: <ArrowUpRight size={20} />,
      color: '#3b82f6',
      bgColor: '#dbeafe',
    },
    {
      key: 'commissionEarned',
      label: t('admin.finance.stats.commissionEarned'),
      value: formatPrice(data.commissionEarned),
      icon: <TrendingUp size={20} />,
      color: '#8b5cf6',
      bgColor: '#ede9fe',
      subtext: data.monthRevenue ? `${t('admin.finance.stats.month')} ${formatPrice(data.monthRevenue)}` : undefined,
    },
  ];

  if (loading) {
    return (
      <div className={styles.statsGrid}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.statCard}>
            <div className={styles.skeleton} style={{ width: '40px', height: '40px', borderRadius: '8px' }} />
            <div>
              <div className={styles.skeleton} style={{ width: '100px', height: '14px', marginBottom: '8px' }} />
              <div className={styles.skeleton} style={{ width: '80px', height: '24px' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.statsGrid}>
      {stats.map((stat) => (
        <div
          key={stat.key}
          className={styles.statCard}
          onClick={() => onStatClick?.(stat.key)}
          style={{ cursor: onStatClick ? 'pointer' : 'default' }}
        >
          <div
            className={styles.iconWrapper}
            style={{ backgroundColor: stat.bgColor, color: stat.color }}
          >
            {stat.icon}
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>{stat.label}</span>
            <span className={styles.statValue} style={{ color: stat.color }}>
              {stat.value}
            </span>
            {stat.subtext && <span className={styles.statSubtext}>{stat.subtext}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FinanceStats;
