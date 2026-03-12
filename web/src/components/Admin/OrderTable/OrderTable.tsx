import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import styles from './OrderTable.module.css';

export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunding';

export interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  travelDate: string;
  quantity: number;
  amount: number;
  status: OrderStatus;
  createdAt: string;
  paidAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface OrderTableProps {
  orders: Order[];
  loading?: boolean;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  onView?: (order: Order) => void;
  onConfirm?: (order: Order) => void;
  onCancel?: (order: Order) => void;
  onRefund?: (order: Order) => void;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  loading = false,
  selectedIds = [],
  onSelect,
  onView,
  onConfirm,
  onCancel,
  onRefund,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  const getStatusLabel = (status: OrderStatus) => {
    const labels: Record<OrderStatus, string> = {
      pending: t('admin.orders.status.pending'),
      confirmed: t('admin.orders.status.confirmed'),
      completed: t('admin.orders.status.completed'),
      cancelled: t('admin.orders.status.cancelled'),
      refunding: t('admin.orders.status.refunding'),
    };
    return labels[status];
  };

  const formatPrice = (price: number) => {
    return `A$${price.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTravelDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (onSelect) {
      onSelect(checked ? orders.map((o) => o.id) : []);
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
              <th>{t('admin.orders.table.orderNo')}</th>
              <th>{t('admin.orders.table.customer')}</th>
              <th>{t('admin.orders.table.product')}</th>
              <th>{t('admin.orders.table.supplier')}</th>
              <th>{t('admin.orders.table.travelDate')}</th>
              <th>{t('admin.orders.table.amount')}</th>
              <th>{t('admin.orders.table.status')}</th>
              <th>{t('admin.orders.table.orderDate')}</th>
              <th>{t('admin.orders.table.actions')}</th>
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
                <td><div className={styles.skeleton} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className={styles.empty}>
        <p>{t('admin.orders.empty')}</p>
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
                checked={selectedIds.length === orders.length && orders.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </th>
            <th>{t('admin.orders.table.orderNo')}</th>
            <th>{t('admin.orders.table.customer')}</th>
            <th>{t('admin.orders.table.product')}</th>
            <th>{t('admin.orders.table.supplier')}</th>
            <th>{t('admin.orders.table.travelDate')}</th>
            <th>{t('admin.orders.table.amount')}</th>
            <th>{t('admin.orders.table.status')}</th>
            <th>{t('admin.orders.table.orderDate')}</th>
            <th>{t('admin.orders.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className={clsx(selectedIds.includes(order.id) && styles.selected)}>
              <td className={styles.checkboxCell}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(order.id)}
                  onChange={(e) => handleSelectOne(order.id, e.target.checked)}
                />
              </td>
              <td>
                <span className={styles.orderNo}>{order.orderNo}</span>
              </td>
              <td>
                <div className={styles.customerInfo}>
                  <span className={styles.customerName}>{order.customerName}</span>
                  <span className={styles.customerPhone}>{order.customerPhone}</span>
                </div>
              </td>
              <td>
                <span className={styles.productName}>{order.productName}</span>
              </td>
              <td>
                <span className={styles.supplierName}>{order.supplierName}</span>
              </td>
              <td>
                <div className={styles.travelInfo}>
                  <span>{formatTravelDate(order.travelDate)}</span>
                  <span className={styles.quantity}>{order.quantity} {t('admin.orders.table.guests')}</span>
                </div>
              </td>
              <td>
                <span className={styles.amount}>{formatPrice(order.amount)}</span>
              </td>
              <td>
                <span className={clsx(styles.statusBadge, styles[order.status])}>
                  {getStatusLabel(order.status)}
                </span>
              </td>
              <td>{formatDate(order.createdAt)}</td>
              <td>
                <div className={styles.actions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onView?.(order)}
                    title={t('admin.orders.actions.view')}
                  >
                    <Eye size={16} />
                  </button>
                  {order.status === 'pending' && (
                    <>
                      <button
                        className={clsx(styles.actionBtn, styles.confirm)}
                        onClick={() => onConfirm?.(order)}
                        title={t('admin.orders.actions.confirm')}
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        className={clsx(styles.actionBtn, styles.cancel)}
                        onClick={() => onCancel?.(order)}
                        title={t('admin.orders.actions.cancel')}
                      >
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                  {order.status === 'refunding' && (
                    <button
                      className={clsx(styles.actionBtn, styles.refund)}
                      onClick={() => onRefund?.(order)}
                      title={t('admin.orders.actions.handleRefund')}
                    >
                      <RotateCcw size={16} />
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

export default OrderTable;
