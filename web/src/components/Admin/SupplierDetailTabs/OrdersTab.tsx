import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw } from 'lucide-react';
import { adminService, type ApiOrder } from '../../../services/adminService';
import styles from '../../../pages/Admin/SupplierDetailPage/SupplierDetailPage.module.css';

interface OrdersTabProps {
  supplierId: number;
}

type StatusFilter = 'all' | 'pending' | 'paid' | 'accepted' | 'completed' | 'cancelled' | 'refunded';

export const OrdersTab: React.FC<OrdersTabProps> = ({ supplierId }) => {
  const { t } = useTranslation();

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Refund modal state
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState<number | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundMaxAmount, setRefundMaxAmount] = useState(0);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: { page: number; page_size: number; status?: string; keyword?: string } = {
        page,
        page_size: 10,
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (keyword.trim()) {
        params.keyword = keyword.trim();
      }
      const res = await adminService.getSupplierOrders(supplierId, params);
      setOrders(res.items || []);
      setTotalPages(res.total_pages || 1);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [supplierId, statusFilter, page]);

  const handleSearch = () => {
    setPage(1);
    loadOrders();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const openRefundModal = (order: ApiOrder) => {
    setRefundOrderId(order.id);
    setRefundMaxAmount(order.total_price);
    setRefundAmount(order.total_price.toFixed(2));
    setRefundReason('');
    setRefundType('full');
    setRefundModalOpen(true);
  };

  const confirmRefund = async () => {
    if (!refundOrderId || !refundReason.trim()) return;
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) return;
    try {
      await adminService.refundOrder(refundOrderId, {
        amount,
        reason: refundReason,
        refund_type: refundType,
      });
      setRefundModalOpen(false);
      loadOrders();
    } catch {
      // silent
    }
  };

  const isRefundable = (status: string) => {
    return status === 'completed' || status === 'paid';
  };

  const isHighlightRow = (status: string) => {
    return status === 'refunded' || status === 'cancelled';
  };

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('admin.suppliers.detail.filter.all') },
    { key: 'pending', label: t('admin.suppliers.detail.filter.pending') },
    { key: 'paid', label: t('admin.suppliers.detail.filter.paid') },
    { key: 'accepted', label: t('admin.suppliers.detail.filter.accepted') },
    { key: 'completed', label: t('admin.suppliers.detail.filter.completed') },
    { key: 'cancelled', label: t('admin.suppliers.detail.filter.cancelled') },
    { key: 'refunded', label: t('admin.suppliers.detail.filter.refunded') },
  ];

  return (
    <div>
      {/* Filter bar */}
      <div className={styles.filterBar}>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter);
            setPage(1);
          }}
        >
          {statusFilters.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('admin.suppliers.detail.searchOrders')}
        />
        <button className={styles.editBtn} onClick={handleSearch}>
          <Search size={16} />
        </button>
        <button className={styles.editBtn} onClick={loadOrders}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Order Table */}
      <div className={styles.section}>
        {loading ? (
          <div className={styles.empty}>{t('common.loading')}</div>
        ) : orders.length === 0 ? (
          <div className={styles.empty}>{t('admin.suppliers.detail.noOrders')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.suppliers.detail.orderTable.orderNo')}</th>
                <th>{t('admin.suppliers.detail.orderTable.product')}</th>
                <th>{t('admin.suppliers.detail.orderTable.customer')}</th>
                <th>{t('admin.suppliers.detail.orderTable.amount')}</th>
                <th>{t('admin.suppliers.detail.orderTable.status')}</th>
                <th>{t('admin.suppliers.detail.orderTable.date')}</th>
                <th>{t('admin.suppliers.detail.orderTable.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className={isHighlightRow(order.status) ? styles.highlight : ''}>
                  <td>{order.order_no}</td>
                  <td>{order.product_name}</td>
                  <td>{order.contact_name || order.user_name}</td>
                  <td>${order.total_price.toFixed(2)}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[order.status] || ''}`}>
                      {t(`admin.suppliers.detail.filter.${order.status}`, order.status)}
                    </span>
                  </td>
                  <td>{new Date(order.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className={styles.inlineActions}>
                      {isRefundable(order.status) && (
                        <button onClick={() => openRefundModal(order)}>
                          {t('admin.suppliers.detail.refund')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('common.prev')}
          </button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {t('common.next')}
          </button>
        </div>
      )}

      {/* Refund Modal */}
      {refundModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setRefundModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>{t('admin.suppliers.detail.refundTitle')}</h2>

            <div className={styles.formGroup}>
              <label>{t('admin.suppliers.detail.refundType')}</label>
              <select
                value={refundType}
                onChange={(e) => {
                  const type = e.target.value as 'full' | 'partial';
                  setRefundType(type);
                  if (type === 'full') {
                    setRefundAmount(refundMaxAmount.toFixed(2));
                  }
                }}
              >
                <option value="full">{t('admin.suppliers.detail.refundFull')}</option>
                <option value="partial">{t('admin.suppliers.detail.refundPartial')}</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>{t('admin.suppliers.detail.refundAmount')}</label>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                min={0}
                max={refundMaxAmount}
                step="0.01"
                disabled={refundType === 'full'}
              />
            </div>

            <div className={styles.formGroup}>
              <label>{t('admin.suppliers.detail.refundReason')}</label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={t('admin.suppliers.detail.refundReasonPlaceholder')}
              />
            </div>

            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setRefundModalOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                className={styles.dangerBtn}
                onClick={confirmRefund}
                disabled={!refundReason.trim() || !refundAmount}
              >
                {t('admin.suppliers.detail.confirmRefund')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
