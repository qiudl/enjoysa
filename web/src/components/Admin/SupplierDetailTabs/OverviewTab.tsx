import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign, ShoppingCart, Star, XCircle, Package } from 'lucide-react';
import { adminService, type ApiRevenueTrendItem, type ApiAuditLogItem, type ApiSupplierDetail } from '../../../services/adminService';
import styles from '../../../pages/Admin/SupplierDetailPage/SupplierDetailPage.module.css';

interface OverviewTabProps {
  supplierId: number;
  stats: ApiSupplierDetail['stats'];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ supplierId, stats }) => {
  const { t } = useTranslation();
  const [trendData, setTrendData] = useState<ApiRevenueTrendItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<ApiAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [trend, logs] = await Promise.all([
          adminService.getSupplierRevenueTrend(supplierId),
          adminService.getSupplierAuditLogs(supplierId),
        ]);
        setTrendData(trend || []);
        setAuditLogs(logs.items || []);
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supplierId]);

  const statCards = [
    {
      label: t('admin.suppliers.detail.stats.totalRevenue'),
      value: `$${(stats.total_revenue || 0).toFixed(2)}`,
      icon: <DollarSign size={20} />,
    },
    {
      label: t('admin.suppliers.detail.stats.totalOrders'),
      value: stats.total_orders || 0,
      icon: <ShoppingCart size={20} />,
    },
    {
      label: t('admin.suppliers.detail.stats.avgRating'),
      value: (stats.avg_rating || 0).toFixed(1),
      icon: <Star size={20} />,
    },
    {
      label: t('admin.suppliers.detail.stats.cancelRate'),
      value: `${((stats.cancel_rate || 0) * 100).toFixed(1)}%`,
      icon: <XCircle size={20} />,
    },
    {
      label: t('admin.suppliers.detail.stats.activeProducts'),
      value: stats.active_products || 0,
      icon: <Package size={20} />,
    },
  ];

  return (
    <div>
      {/* Stat Cards */}
      <div className={styles.statsGrid}>
        {statCards.map((card, idx) => (
          <div key={idx} className={styles.statCard}>
            <div className={styles.statLabel}>{card.label}</div>
            <div className={styles.statValue}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Revenue Trend Chart */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t('admin.suppliers.detail.revenueTrend')}
        </h3>
        {loading ? (
          <div className={styles.empty}>{t('common.loading')}</div>
        ) : trendData.length === 0 ? (
          <div className={styles.empty}>{t('admin.suppliers.detail.noData')}</div>
        ) : (
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, t('admin.suppliers.detail.stats.totalRevenue')]}
                  labelFormatter={(label) => String(label)}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Audit Log Timeline */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t('admin.suppliers.detail.auditLog')}
        </h3>
        {loading ? (
          <div className={styles.empty}>{t('common.loading')}</div>
        ) : auditLogs.length === 0 ? (
          <div className={styles.empty}>{t('admin.suppliers.detail.noLogs')}</div>
        ) : (
          <div className={styles.timeline}>
            {auditLogs.map((log) => (
              <div key={log.id} className={styles.timelineItem}>
                <span className={`${styles.source} ${styles[log.source]}`}>
                  {log.source}
                </span>
                <div className={styles.info}>
                  <strong>{log.action}</strong> &mdash; {log.detail}
                  <br />
                  <small>{log.user_name}</small>
                </div>
                <span className={styles.time}>
                  {new Date(log.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewTab;
