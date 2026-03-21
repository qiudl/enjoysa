import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header, Footer } from '../../../components/Common';
import { getAuditLogs, type AuditLog } from '../../../services/supplierDashboardService';
import styles from './SupplierAuditLogPage.module.css';

export interface SupplierAuditLogPageProps {
  supplierName?: string;
}

export const SupplierAuditLogPage: React.FC<SupplierAuditLogPageProps> = ({
  supplierName = '供应商',
}) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await getAuditLogs({
        page,
        page_size: 20,
        action: actionFilter || undefined,
        resource_type: resourceFilter || undefined,
      });
      setLogs(result.items || []);
      setTotal(result.total);
    } catch {
      // error handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, resourceFilter]);

  const actionOptions = ['create', 'update', 'delete', 'online', 'offline', 'refund'];
  const resourceOptions = ['product', 'order', 'schedule', 'profile'];

  const totalPages = Math.ceil(total / 20);

  return (
    <div className={styles.page}>
      <Header isLoggedIn userName={supplierName} />

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{t('supplier.auditLog.title')}</h1>
          </div>

          {/* Filters */}
          <div className={styles.toolbar}>
            <select
              className={styles.filterSelect}
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            >
              <option value="">{t('supplier.auditLog.allActions')}</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>{t(`supplier.auditLog.actions.${a}`)}</option>
              ))}
            </select>
            <select
              className={styles.filterSelect}
              value={resourceFilter}
              onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
            >
              <option value="">{t('supplier.auditLog.allResources')}</option>
              {resourceOptions.map((r) => (
                <option key={r} value={r}>{t(`supplier.auditLog.resources.${r}`)}</option>
              ))}
            </select>
            <span className={styles.totalCount}>
              {t('supplier.auditLog.totalRecords', { count: total })}
            </span>
          </div>

          {/* Log List */}
          <div className={styles.logList}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : logs.length === 0 ? (
              <div className={styles.empty}>{t('common.noData')}</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={styles.logItem}>
                  <div className={styles.logHeader}>
                    <span className={styles.logAction}>
                      {t(`supplier.auditLog.actions.${log.action}`, log.action)}
                    </span>
                    <span className={styles.logResource}>
                      {t(`supplier.auditLog.resources.${log.resource_type}`, log.resource_type)}
                    </span>
                    <span className={styles.logTime}>
                      {log.created_at?.replace('T', ' ').slice(0, 19)}
                    </span>
                  </div>
                  <div className={styles.logBody}>
                    <span className={styles.logResourceName}>{log.resource_name}</span>
                    <span className={styles.logUser}>{log.user_name}</span>
                    <span className={styles.logIp}>{log.ip}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                &lt;
              </button>
              <span className={styles.pageInfo}>{page} / {totalPages}</span>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                &gt;
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SupplierAuditLogPage;
