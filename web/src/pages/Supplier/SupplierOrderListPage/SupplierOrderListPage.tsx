import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header, Footer, Button, Modal } from '../../../components/Common';
import { listSupplierOrders, acceptOrder, refundOrder, updateOrderRemark, type Order as ApiOrder } from '../../../services/orderService';
import styles from './SupplierOrderListPage.module.css';

export interface SupplierOrder {
  id: string;
  numericId: number;
  productTitle: string;
  productTitleEn: string;
  customerName: string;
  customerPhone: string;
  travelDate: string;
  quantity: number;
  amount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunding';
  channel: string;
  createdAt: string;
}

export interface SupplierOrderListPageProps {
  /** 供应商名称 */
  supplierName?: string;
  /** 导航回调 */
  onNavigate?: (path: string) => void;
}

const statusMap: Record<string, SupplierOrder['status']> = {
  pending: 'pending',
  paid: 'pending',
  accepted: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
  refunded: 'refunding',
};

function transformOrder(o: ApiOrder): SupplierOrder {
  return {
    id: o.order_no || String(o.id),
    numericId: o.id,
    productTitle: o.product_name,
    productTitleEn: o.product_name,
    customerName: o.contact_name,
    customerPhone: o.contact_phone,
    travelDate: o.booking_date,
    quantity: o.quantity || o.guest_count,
    amount: o.total_price,
    status: statusMap[o.status] || 'pending',
    channel: o.channel || 'direct',
    createdAt: o.created_at?.replace('T', ' ').slice(0, 16) || '',
  };
}

export const SupplierOrderListPage: React.FC<SupplierOrderListPageProps> = ({
  supplierName = '祥龙旅行社',
}) => {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null);
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [remarkText, setRemarkText] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);

  useEffect(() => {
    const params: Record<string, string | number> = { page: 1, page_size: 50 };
    if (channelFilter !== 'all') {
      params.channel = channelFilter;
    }
    listSupplierOrders(params as never)
      .then((result) => {
        setOrders((result.orders || []).map(transformOrder));
      })
      .catch(() => {});
  }, [channelFilter]);

  const filters = [
    { key: 'all', label: t('supplier.orders.all') },
    { key: 'pending', label: t('supplier.orders.pending') },
    { key: 'confirmed', label: t('supplier.orders.confirmed') },
    { key: 'completed', label: t('supplier.orders.completed') },
    { key: 'refunding', label: t('supplier.orders.refunding') },
  ];

  const channelFilters = [
    { key: 'all', label: t('supplier.orders.channels.all') },
    { key: 'direct', label: t('supplier.orders.channels.direct') },
    { key: 'trip_com', label: t('supplier.orders.channels.tripCom') },
  ];

  const filteredOrders = orders.filter((order) => {
    if (filter !== 'all' && order.status !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        order.id.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Channel stats
  const directCount = orders.filter((o) => o.channel === 'direct').length;
  const tripComCount = orders.filter((o) => o.channel === 'trip_com').length;
  const directAmount = orders
    .filter((o) => o.channel === 'direct' && o.status === 'completed')
    .reduce((sum, o) => sum + o.amount, 0);
  const tripComAmount = orders
    .filter((o) => o.channel === 'trip_com' && o.status === 'completed')
    .reduce((sum, o) => sum + o.amount, 0);

  const getStatusStyle = (status: string) => {
    const statusStyles: Record<string, { bg: string; color: string }> = {
      pending: { bg: '#fef3c7', color: '#92400e' },
      confirmed: { bg: '#dbeafe', color: '#1e40af' },
      completed: { bg: '#dcfce7', color: '#166534' },
      cancelled: { bg: '#f3f4f6', color: '#6b7280' },
      refunding: { bg: '#fee2e2', color: '#991b1b' },
    };
    return statusStyles[status] || statusStyles.pending;
  };

  const getChannelBadge = (channel: string) => {
    if (channel === 'trip_com') {
      return (
        <span className={styles.channelBadge} data-channel="trip_com">
          Trip.com
        </span>
      );
    }
    return null;
  };

  const handleConfirm = (order: SupplierOrder) => {
    setSelectedOrder(order);
    setShowConfirmModal(true);
  };

  const handleRefund = (order: SupplierOrder) => {
    setSelectedOrder(order);
    setRefundType('full');
    setRefundReason('');
    setRefundAmount(String(order.amount));
    setShowRefundModal(true);
  };

  const handleRemark = (order: SupplierOrder) => {
    setSelectedOrder(order);
    setRemarkText('');
    setShowRemarkModal(true);
  };

  const submitRefund = async () => {
    if (!selectedOrder || !refundReason.trim()) return;
    setRefundLoading(true);
    try {
      await refundOrder(selectedOrder.numericId, {
        type: refundType,
        reason: refundReason,
        amount: refundType === 'partial' ? parseFloat(refundAmount) : undefined,
      });
      setOrders((prev) => prev.map((o) => o.id === selectedOrder.id ? { ...o, status: 'refunding' as const } : o));
      setShowRefundModal(false);
    } catch {
      // error handled by API layer
    } finally {
      setRefundLoading(false);
    }
  };

  const submitRemark = async () => {
    if (!selectedOrder || !remarkText.trim()) return;
    try {
      await updateOrderRemark(selectedOrder.numericId, { supplier_remark: remarkText });
      setShowRemarkModal(false);
    } catch {
      // error handled by API layer
    }
  };

  return (
    <div className={styles.page}>
      <Header isLoggedIn userName={supplierName} />

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{t('supplier.orders.title')}</h1>
          </div>

          {/* Channel Stats */}
          {tripComCount > 0 && (
            <div className={styles.channelStats}>
              <div className={styles.channelStatCard}>
                <span className={styles.channelStatLabel}>{t('supplier.orders.channels.direct')}</span>
                <span className={styles.channelStatCount}>{directCount} {t('supplier.orders.channelOrders')}</span>
                <span className={styles.channelStatAmount}>AUD {directAmount.toFixed(2)}</span>
              </div>
              <div className={`${styles.channelStatCard} ${styles.tripComCard}`}>
                <span className={styles.channelStatLabel}>Trip.com</span>
                <span className={styles.channelStatCount}>{tripComCount} {t('supplier.orders.channelOrders')}</span>
                <span className={styles.channelStatAmount}>AUD {tripComAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Channel Filter */}
          <div className={styles.channelFilters}>
            {channelFilters.map((f) => (
              <button
                key={f.key}
                className={`${styles.channelFilterBtn} ${channelFilter === f.key ? styles.active : ''}`}
                onClick={() => setChannelFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Status Filters and Search */}
          <div className={styles.toolbar}>
            <div className={styles.filters}>
              {filters.map((f) => (
                <button
                  key={f.key}
                  className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className={styles.search}>
              <input
                type="text"
                placeholder={t('supplier.orders.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* Order List */}
          {filteredOrders.length > 0 ? (
            <div className={styles.orderList}>
              {filteredOrders.map((order) => {
                const statusStyle = getStatusStyle(order.status);
                return (
                  <div key={order.id} className={styles.orderCard}>
                    <div className={styles.orderHeader}>
                      <div className={styles.orderHeaderLeft}>
                        <span className={styles.orderId}>{order.id}</span>
                        {getChannelBadge(order.channel)}
                      </div>
                      <span
                        className={styles.orderStatus}
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                      >
                        {t(`supplier.orders.statusLabels.${order.status}`)}
                      </span>
                    </div>
                    <div className={styles.orderBody}>
                      <div className={styles.orderInfo}>
                        <h3 className={styles.productTitle}>
                          {i18n.language === 'en' ? order.productTitleEn : order.productTitle}
                        </h3>
                        <div className={styles.orderMeta}>
                          <span>{t('supplier.orders.travelDate')}: {order.travelDate}</span>
                          <span>{t('supplier.orders.quantity')}: {order.quantity} {t('supplier.orders.guests')}</span>
                        </div>
                        <div className={styles.customerInfo}>
                          <span>{order.customerName}</span>
                          <span>{order.customerPhone}</span>
                        </div>
                      </div>
                      <div className={styles.orderAmount}>
                        <span className={styles.amountLabel}>{t('supplier.orders.amount')}</span>
                        <span className={styles.amountValue}>AUD {order.amount.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className={styles.orderFooter}>
                      <span className={styles.orderTime}>{order.createdAt}</span>
                      <div className={styles.orderActions}>
                        <Button size="sm" variant="outline" onClick={() => handleRemark(order)}>
                          {t('supplier.orders.addRemark')}
                        </Button>
                        {order.status === 'pending' && (
                          <Button size="sm" variant="primary" onClick={() => handleConfirm(order)}>
                            {t('supplier.orders.confirm')}
                          </Button>
                        )}
                        {order.status === 'confirmed' && (
                          <>
                            <Button size="sm" variant="primary">
                              {t('supplier.orders.complete')}
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => handleRefund(order)}>
                              {t('supplier.orders.refund')}
                            </Button>
                          </>
                        )}
                        {order.status === 'refunding' && (
                          <Button size="sm" variant="danger" onClick={() => handleRefund(order)}>
                            {t('supplier.orders.handleRefund')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📋</span>
              <p className={styles.emptyText}>{t('supplier.orders.noOrders')}</p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Confirm Order Modal */}
      <Modal
        open={showConfirmModal}
        title={t('supplier.orders.confirmOrder')}
        size="sm"
        onClose={() => setShowConfirmModal(false)}
        onOk={async () => {
          if (selectedOrder) {
            try {
              await acceptOrder(selectedOrder.numericId);
              setOrders((prev) => prev.map((o) => o.id === selectedOrder.id ? { ...o, status: 'confirmed' as const } : o));
            } catch { /* ignore */ }
          }
          setShowConfirmModal(false);
        }}
      >
        <p>{t('supplier.orders.confirmOrderDesc')}</p>
        {selectedOrder && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 500 }}>
              {i18n.language === 'en' ? selectedOrder.productTitleEn : selectedOrder.productTitle}
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
              {t('supplier.orders.customer')}: {selectedOrder.customerName} | {t('supplier.orders.travelDate')}: {selectedOrder.travelDate}
            </p>
          </div>
        )}
      </Modal>

      {/* Refund Modal */}
      <Modal
        open={showRefundModal}
        title={t('supplier.orders.refund')}
        size="sm"
        onClose={() => setShowRefundModal(false)}
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setShowRefundModal(false)}>
              {t('supplier.orders.cancel')}
            </Button>
            <Button variant="danger" onClick={submitRefund} disabled={refundLoading || !refundReason.trim()}>
              {refundLoading ? t('common.processing') : t('supplier.orders.confirmRefund')}
            </Button>
          </div>
        }
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 500 }}>
                {i18n.language === 'en' ? selectedOrder.productTitleEn : selectedOrder.productTitle}
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                {t('supplier.orders.amount')}: AUD {selectedOrder.amount.toFixed(2)}
              </p>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                {t('supplier.orders.refundType')}
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input type="radio" checked={refundType === 'full'} onChange={() => { setRefundType('full'); setRefundAmount(String(selectedOrder.amount)); }} />
                  {t('supplier.orders.fullRefund')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input type="radio" checked={refundType === 'partial'} onChange={() => setRefundType('partial')} />
                  {t('supplier.orders.partialRefund')}
                </label>
              </div>
            </div>
            {refundType === 'partial' && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                  {t('supplier.orders.refundAmountLabel')}
                </label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  max={selectedOrder.amount}
                  min={0.01}
                  step="0.01"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}
                />
              </div>
            )}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                {t('supplier.orders.refundReason')} *
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={t('supplier.orders.refundReasonPlaceholder')}
                rows={3}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.875rem', resize: 'vertical' }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Remark Modal */}
      <Modal
        open={showRemarkModal}
        title={t('supplier.orders.addRemark')}
        size="sm"
        onClose={() => setShowRemarkModal(false)}
        onOk={submitRemark}
      >
        {selectedOrder && (
          <div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
              {t('supplier.orders.orderNo')}: {selectedOrder.id}
            </p>
            <textarea
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder={t('supplier.orders.remarkPlaceholder')}
              rows={4}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.875rem', resize: 'vertical' }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SupplierOrderListPage;
