import React from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { StatCard } from '../StatCard';
import styles from './SupplierStats.module.css';

export interface SupplierStatsData {
  total: number;
  pending: number;
  approved: number;
  suspended: number;
  todayNew?: number;
}

export interface SupplierStatsProps {
  data: SupplierStatsData;
  loading?: boolean;
  onStatClick?: (status: string) => void;
}

export const SupplierStats: React.FC<SupplierStatsProps> = ({
  data,
  loading = false,
  onStatClick,
}) => {
  const { t } = useTranslation();

  const stats = [
    {
      key: 'total',
      title: t('admin.suppliers.stats.total'),
      titleEn: 'Total Suppliers',
      value: data.total,
      icon: <Building2 size={24} />,
      variant: 'primary' as const,
    },
    {
      key: 'pending',
      title: t('admin.suppliers.stats.pending'),
      titleEn: 'Pending Review',
      value: data.pending,
      icon: <Clock size={24} />,
      variant: 'warning' as const,
    },
    {
      key: 'approved',
      title: t('admin.suppliers.stats.approved'),
      titleEn: 'Approved',
      value: data.approved,
      icon: <CheckCircle size={24} />,
      variant: 'success' as const,
    },
    {
      key: 'suspended',
      title: t('admin.suppliers.stats.suspended'),
      titleEn: 'Suspended',
      value: data.suspended,
      icon: <XCircle size={24} />,
      variant: 'danger' as const,
    },
  ];

  return (
    <div className={styles.statsGrid}>
      {stats.map((stat) => (
        <StatCard
          key={stat.key}
          title={stat.title}
          titleEn={stat.titleEn}
          value={stat.value}
          icon={stat.icon}
          variant={stat.variant}
          loading={loading}
          onClick={onStatClick ? () => onStatClick(stat.key) : undefined}
        />
      ))}
    </div>
  );
};

export default SupplierStats;
