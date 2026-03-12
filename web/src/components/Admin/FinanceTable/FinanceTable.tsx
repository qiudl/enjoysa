import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Download, Building2, Receipt } from 'lucide-react';
import clsx from 'clsx';
import styles from './FinanceTable.module.css';

export type SettlementStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Settlement {
  id: string;
  settlementNo: string;
  supplierId: string;
  supplierName: string;
  period: string;
  orderCount: number;
  totalAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  status: SettlementStatus;
  createdAt: string;
  paidAt?: string;
}

export interface FinanceTableProps {
  settlements: Settlement[];
  loading?: boolean;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  onView?: (settlement: Settlement) => void;
  onDownload?: (settlement: Settlement) => void;
  onProcess?: (settlement: Settlement) => void;
}

export const FinanceTable: React.FC<FinanceTableProps> = ({
  settlements,
  loading = false,
  selectedIds = [],
  onSelect,
  onView,
  onDownload,
  onProcess,
}) => {
  const { t } = useTranslation();

  const getStatusLabel = (status: SettlementStatus) => {
    const labels: Record<SettlementStatus, string> = {
      pending: t('admin.finance.status.pending'),
      processing: t('admin.finance.status.processing'),
      completed: t('admin.finance.status.completed'),
      failed: t('admin.finance.status.failed'),
    };
    return labels[status];
  };

  const formatPrice = (price: number) => {
    return `A$${price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelect?.(settlements.map((s) => s.id));
    } else {
      onSelect?.([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelect?.([...selectedIds, id]);
    } else {
      onSelect?.(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  if (loading) {
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxCell}>
                <input type="checkbox" disabled />
              </th>
              <th>{t('admin.finance.table.settlementNo')}</th>
              <th>{t('admin.finance.table.supplier')}</th>
              <th>{t('admin.finance.table.period')}</th>
              <th>{t('admin.finance.table.orders')}</th>
              <th>{t('admin.finance.table.totalAmount')}</th>
              <th>{t('admin.finance.table.commission')}</th>
              <th>{t('admin.finance.table.netAmount')}</th>
              <th>{t('admin.finance.table.status')}</th>
              <th>{t('admin.finance.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className={styles.skeletonRow}>
                <td><div className={styles.skeleton} style={{ width: '16px', height: '16px' }} /></td>
                <td><div className={styles.skeleton} style={{ width: '120px' }} /></td>
                <td><div className={styles.skeleton} style={{ width: '100px' }} /></td>
                <td><div className={styles.skeleton} style={{ width: '100px' }} /></td>
                <td><div className={styles.skeleton} style={{ width: '40px' }} /></td>
                <td><div className={styles.skeleton} style={{ width: '80px' }} /></td>
                <td><div className={styles.skeleton} style={{ width: '60px' }} /></td>
                <td><div className={styles.skeleton} style={{ width: '80px' }} /></td>
                <td><div className={styles.skeleton} style={{ width: '60px' }} /></td>
                <td><div className={styles.skeleton} style={{ width: '80px' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (settlements.length === 0) {
    return (
      <div className={styles.empty}>
        <Receipt size={48} />
        <p>{t('admin.finance.empty')}</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.checkboxCell}>
              <input
                type="checkbox"
                checked={selectedIds.length === settlements.length && settlements.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </th>
            <th>{t('admin.finance.table.settlementNo')}</th>
            <th>{t('admin.finance.table.supplier')}</th>
            <th>{t('admin.finance.table.period')}</th>
            <th>{t('admin.finance.table.orders')}</th>
            <th>{t('admin.finance.table.totalAmount')}</th>
            <th>{t('admin.finance.table.commission')}</th>
            <th>{t('admin.finance.table.netAmount')}</th>
            <th>{t('admin.finance.table.status')}</th>
            <th>{t('admin.finance.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {settlements.map((settlement) => (
            <tr
              key={settlement.id}
              className={clsx(selectedIds.includes(settlement.id) && styles.selected)}
            >
              <td className={styles.checkboxCell}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(settlement.id)}
                  onChange={(e) => handleSelectOne(settlement.id, e.target.checked)}
                />
              </td>
              <td>
                <span className={styles.settlementNo}>{settlement.settlementNo}</span>
              </td>
              <td>
                <div className={styles.supplierInfo}>
                  <div className={styles.supplierIcon}>
                    <Building2 size={16} />
                  </div>
                  <span className={styles.supplierName}>{settlement.supplierName}</span>
                </div>
              </td>
              <td className={styles.period}>{settlement.period}</td>
              <td className={styles.orderCount}>{settlement.orderCount}</td>
              <td className={styles.totalAmount}>{formatPrice(settlement.totalAmount)}</td>
              <td className={styles.commission}>
                -{formatPrice(settlement.commissionAmount)}
                <span className={styles.commissionRate}>({settlement.commissionRate}%)</span>
              </td>
              <td className={styles.netAmount}>{formatPrice(settlement.netAmount)}</td>
              <td>
                <span className={clsx(styles.statusBadge, styles[settlement.status])}>
                  {getStatusLabel(settlement.status)}
                </span>
              </td>
              <td>
                <div className={styles.actions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onView?.(settlement)}
                    title={t('admin.finance.actions.view')}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onDownload?.(settlement)}
                    title={t('admin.finance.actions.download')}
                  >
                    <Download size={16} />
                  </button>
                  {settlement.status === 'pending' && (
                    <button
                      className={clsx(styles.actionBtn, styles.process)}
                      onClick={() => onProcess?.(settlement)}
                      title={t('admin.finance.actions.process')}
                    >
                      {t('admin.finance.actions.process')}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FinanceTable;
