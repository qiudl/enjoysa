import React from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import styles from './ProductReviewStats.module.css';

export interface ProductReviewStatsData {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  todayNew?: number;
}

export interface ProductReviewStatsProps {
  data: ProductReviewStatsData;
  loading?: boolean;
  onStatClick?: (status: string) => void;
}

export const ProductReviewStats: React.FC<ProductReviewStatsProps> = ({
  data,
  loading = false,
  onStatClick,
}) => {
  const { t } = useTranslation();

  const stats = [
    {
      key: 'total',
      label: t('admin.products.stats.total'),
      value: data.total,
      icon: <Package size={24} />,
      color: 'blue',
      extra: data.todayNew ? `+${data.todayNew} ${t('admin.products.stats.today')}` : undefined,
    },
    {
      key: 'pending',
      label: t('admin.products.stats.pending'),
      value: data.pending,
      icon: <Clock size={24} />,
      color: 'orange',
    },
    {
      key: 'approved',
      label: t('admin.products.stats.approved'),
      value: data.approved,
      icon: <CheckCircle size={24} />,
      color: 'green',
    },
    {
      key: 'rejected',
      label: t('admin.products.stats.rejected'),
      value: data.rejected,
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

export default ProductReviewStats;
