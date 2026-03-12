import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import styles from './OrderStats.module.css';

export interface OrderStatsData {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  todayOrders?: number;
  todayRevenue?: number;
}

export interface OrderStatsProps {
  data: OrderStatsData;
  loading?: boolean;
  onStatClick?: (status: string) => void;
}

export const OrderStats: React.FC<OrderStatsProps> = ({
  data,
  loading = false,
  onStatClick,
}) => {
  const { t } = useTranslation();

  const stats = [
    {
      key: 'total',
      label: t('admin.orders.stats.total'),
      value: data.total,
      icon: <ShoppingCart size={24} />,
      color: 'blue',
      extra: data.todayOrders ? `+${data.todayOrders} ${t('admin.orders.stats.today')}` : undefined,
    },
    {
      key: 'pending',
      label: t('admin.orders.stats.pending'),
      value: data.pending,
      icon: <Clock size={24} />,
      color: 'orange',
    },
    {
      key: 'confirmed',
      label: t('admin.orders.stats.confirmed'),
      value: data.confirmed,
      icon: <CheckCircle size={24} />,
      color: 'green',
    },
    {
      key: 'completed',
      label: t('admin.orders.stats.completed'),
      value: data.completed,
      icon: <CheckCircle size={24} />,
      color: 'purple',
    },
    {
      key: 'cancelled',
      label: t('admin.orders.stats.cancelled'),
      value: data.cancelled,
      icon: <XCircle size={24} />,
      color: 'red',
    },
  ];

  if (loading) {
    return (
      <div className={styles.statsGrid}>
        {stats.map((stat) => (
          <div key={stat.key} className={clsx(styles.statCard, styles.skeleton)}>
            <div className={styles.skeletonIcon} />
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonValue} />
              <div className={styles.skeletonLabel} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.statsGrid}>
      {stats.map((stat) => (
        <button
          key={stat.key}
          className={clsx(styles.statCard, styles[stat.color])}
          onClick={() => onStatClick?.(stat.key)}
        >
          <div className={styles.iconWrapper}>
            {stat.icon}
          </div>
          <div className={styles.content}>
            <span className={styles.value}>{stat.value}</span>
            <span className={styles.label}>{stat.label}</span>
            {stat.extra && (
              <span className={styles.extra}>
                <TrendingUp size={12} />
                {stat.extra}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};

export default OrderStats;
