import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, UserPlus, UserCheck, UserX, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import styles from './UserStats.module.css';

export interface UserStatsData {
  total: number;
  active: number;
  inactive: number;
  newToday?: number;
  newThisMonth?: number;
}

export interface UserStatsProps {
  data: UserStatsData;
  loading?: boolean;
  onStatClick?: (status: string) => void;
}

export const UserStats: React.FC<UserStatsProps> = ({
  data,
  loading = false,
  onStatClick,
}) => {
  const { t } = useTranslation();

  const stats = [
    {
      key: 'total',
      label: t('admin.users.stats.total'),
      value: data.total,
      icon: <Users size={24} />,
      color: 'blue',
      extra: data.newToday ? `+${data.newToday} ${t('admin.users.stats.today')}` : undefined,
    },
    {
      key: 'active',
      label: t('admin.users.stats.active'),
      value: data.active,
      icon: <UserCheck size={24} />,
      color: 'green',
    },
    {
      key: 'inactive',
      label: t('admin.users.stats.inactive'),
      value: data.inactive,
      icon: <UserX size={24} />,
      color: 'gray',
    },
    {
      key: 'newThisMonth',
      label: t('admin.users.stats.newThisMonth'),
      value: data.newThisMonth || 0,
      icon: <UserPlus size={24} />,
      color: 'purple',
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

export default UserStats;
