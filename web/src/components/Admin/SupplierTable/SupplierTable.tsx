import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, CheckCircle, XCircle, Ban } from 'lucide-react';
import clsx from 'clsx';
import styles from './SupplierTable.module.css';

export type SupplierStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type SupplierType = 'travel_agency' | 'hotel' | 'attraction' | 'restaurant' | 'car_rental';

export interface Supplier {
  id: string;
  name: string;
  nameEn?: string;
  type: SupplierType;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  status: SupplierStatus;
  productCount: number;
  orderCount: number;
  createdAt: string;
  logo?: string;
}

export interface SupplierTableProps {
  suppliers: Supplier[];
  loading?: boolean;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  onView?: (supplier: Supplier) => void;
  onApprove?: (supplier: Supplier) => void;
  onReject?: (supplier: Supplier) => void;
  onSuspend?: (supplier: Supplier) => void;
}

export const SupplierTable: React.FC<SupplierTableProps> = ({
  suppliers,
  loading = false,
  selectedIds = [],
  onSelect,
  onView,
  onApprove,
  onReject,
  onSuspend,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  const getStatusLabel = (status: SupplierStatus) => {
    const labels: Record<SupplierStatus, string> = {
      pending: t('admin.suppliers.status.pending'),
      approved: t('admin.suppliers.status.approved'),
      rejected: t('admin.suppliers.status.rejected'),
      suspended: t('admin.suppliers.status.suspended'),
    };
    return labels[status];
  };

  const getTypeLabel = (type: SupplierType) => {
    const labels: Record<SupplierType, string> = {
      travel_agency: t('supplier.types.travel_agency'),
      hotel: t('supplier.types.hotel'),
      attraction: t('supplier.types.attraction'),
      restaurant: t('supplier.types.restaurant'),
      car_rental: t('supplier.types.car_rental'),
    };
    return labels[type];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (onSelect) {
      onSelect(checked ? suppliers.map((s) => s.id) : []);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (onSelect) {
      if (checked) {
        onSelect([...selectedIds, id]);
      } else {
        onSelect(selectedIds.filter((i) => i !== id));
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxCell}></th>
              <th>{t('admin.suppliers.table.name')}</th>
              <th>{t('admin.suppliers.table.type')}</th>
              <th>{t('admin.suppliers.table.contact')}</th>
              <th>{t('admin.suppliers.table.products')}</th>
              <th>{t('admin.suppliers.table.orders')}</th>
              <th>{t('admin.suppliers.table.status')}</th>
              <th>{t('admin.suppliers.table.joinDate')}</th>
              <th>{t('admin.suppliers.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className={styles.skeletonRow}>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <div className={styles.empty}>
        <p>{t('admin.suppliers.empty')}</p>
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
                checked={selectedIds.length === suppliers.length && suppliers.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </th>
            <th>{t('admin.suppliers.table.name')}</th>
            <th>{t('admin.suppliers.table.type')}</th>
            <th>{t('admin.suppliers.table.contact')}</th>
            <th>{t('admin.suppliers.table.products')}</th>
            <th>{t('admin.suppliers.table.orders')}</th>
            <th>{t('admin.suppliers.table.status')}</th>
            <th>{t('admin.suppliers.table.joinDate')}</th>
            <th>{t('admin.suppliers.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id} className={clsx(selectedIds.includes(supplier.id) && styles.selected)}>
              <td className={styles.checkboxCell}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(supplier.id)}
                  onChange={(e) => handleSelectOne(supplier.id, e.target.checked)}
                />
              </td>
              <td>
                <div className={styles.supplierName}>
                  {supplier.logo ? (
                    <img src={supplier.logo} alt="" className={styles.logo} />
                  ) : (
                    <div className={styles.logoPlaceholder}>
                      {supplier.name.charAt(0)}
                    </div>
                  )}
                  <div className={styles.nameInfo}>
                    <span className={styles.name}>{supplier.name}</span>
                    {supplier.nameEn && (
                      <span className={styles.nameEn}>{supplier.nameEn}</span>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <span className={styles.typeTag}>{getTypeLabel(supplier.type)}</span>
              </td>
              <td>
                <div className={styles.contactInfo}>
                  <span>{supplier.contactName}</span>
                  <span className={styles.contactDetail}>{supplier.contactPhone}</span>
                </div>
              </td>
              <td>{supplier.productCount}</td>
              <td>{supplier.orderCount}</td>
              <td>
                <span className={clsx(styles.statusBadge, styles[supplier.status])}>
                  {getStatusLabel(supplier.status)}
                </span>
              </td>
              <td>{formatDate(supplier.createdAt)}</td>
              <td>
                <div className={styles.actions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onView?.(supplier)}
                    title={t('admin.suppliers.actions.view')}
                  >
                    <Eye size={16} />
                  </button>
                  {supplier.status === 'pending' && (
                    <>
                      <button
                        className={clsx(styles.actionBtn, styles.approve)}
                        onClick={() => onApprove?.(supplier)}
                        title={t('admin.suppliers.actions.approve')}
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        className={clsx(styles.actionBtn, styles.reject)}
                        onClick={() => onReject?.(supplier)}
                        title={t('admin.suppliers.actions.reject')}
                      >
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                  {supplier.status === 'approved' && (
                    <button
                      className={clsx(styles.actionBtn, styles.suspend)}
                      onClick={() => onSuspend?.(supplier)}
                      title={t('admin.suppliers.actions.suspend')}
                    >
                      <Ban size={16} />
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

export default SupplierTable;
