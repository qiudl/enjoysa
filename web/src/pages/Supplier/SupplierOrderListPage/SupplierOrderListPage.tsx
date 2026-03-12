import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header, Footer, Button, Modal } from '../../../components/Common';
import styles from './SupplierOrderListPage.module.css';

export interface SupplierOrder {
  id: string;
  productTitle: string;
  productTitleEn: string;
  customerName: string;
  customerPhone: string;
  travelDate: string;
  quantity: number;
  amount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunding';
  createdAt: string;
}

export interface SupplierOrderListPageProps {
  /** 供应商名称 */
  supplierName?: string;
  /** 导航回调 */
  onNavigate?: (path: string) => void;
}

// Mock orders
const mockOrders: SupplierOrder[] = [
  {
    id: 'ORD-20260130-0001',
    productTitle: '袋鼠岛一日游',
    productTitleEn: 'Kangaroo Island Day Tour',
    customerName: '张三',
    customerPhone: '138****8000',
    travelDate: '2026-02-05',
    quantity: 2,
    amount: 778,
    status: 'pending',
    createdAt: '2026-01-30 09:30',
  },
  {
    id: 'ORD-20260130-0002',
    productTitle: '巴罗萨谷酒庄之旅',
    productTitleEn: 'Barossa Valley Winery Tour',
    customerName: '李四',
    customerPhone: '139****9000',
    travelDate: '2026-02-08',
    quantity: 4,
    amount: 1196,
    status: 'confirmed',
    createdAt: '2026-01-30 08:15',
  },
  {
    id: 'ORD-20260129-0003',
    productTitle: '阿德莱德市区观光',
    productTitleEn: 'Adelaide City Tour',
    customerName: 'John Doe',
    customerPhone: '+61 4****5678',
    travelDate: '2026-01-29',
    quantity: 2,
    amount: 318,
    status: 'completed',
    createdAt: '2026-01-28 14:20',
  },
  {
    id: 'ORD-20260128-0004',
    productTitle: '袋鼠岛一日游',
    productTitleEn: 'Kangaroo Island Day Tour',
    customerName: '王五',
    customerPhone: '137****7000',
    travelDate: '2026-02-01',
    quantity: 3,
    amount: 1167,
    status: 'refunding',
    createdAt: '2026-01-28 10:00',
  },
];

export const SupplierOrderListPage: React.FC<SupplierOrderListPageProps> = ({
  supplierName = '祥龙旅行社',
}) => {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null);

  const filters = [
    { key: 'all', label: t('supplier.orders.all') },
    { key: 'pending', label: t('supplier.orders.pending') },
    { key: 'confirmed', label: t('supplier.orders.confirmed') },
    { key: 'completed', label: t('supplier.orders.completed') },
    { key: 'refunding', label: t('supplier.orders.refunding') },
  ];

  const filteredOrders = mockOrders.filter((order) => {
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

  const getStatusStyle = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      pending: { bg: '#fef3c7', color: '#92400e' },
      confirmed: { bg: '#dbeafe', color: '#1e40af' },
      completed: { bg: '#dcfce7', color: '#166534' },
      cancelled: { bg: '#f3f4f6', color: '#6b7280' },
      refunding: { bg: '#fee2e2', color: '#991b1b' },
    };
    return styles[status] || styles.pending;
  };

  const handleConfirm = (order: SupplierOrder) => {
    setSelectedOrder(order);
    setShowConfirmModal(true);
  };

  const handleRefund = (order: SupplierOrder) => {
    setSelectedOrder(order);
    setShowRefundModal(true);
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

          {/* Filters and Search */}
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
                      <span className={styles.orderId}>{order.id}</span>
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
                        <span className={styles.amountValue}>¥{order.amount}</span>
                      </div>
                    </div>
                    <div className={styles.orderFooter}>
                      <span className={styles.orderTime}>{order.createdAt}</span>
                      <div className={styles.orderActions}>
                        <Button size="sm" variant="outline">
                          {t('supplier.orders.viewDetail')}
                        </Button>
                        {order.status === 'pending' && (
                          <Button size="sm" variant="primary" onClick={() => handleConfirm(order)}>
                            {t('supplier.orders.confirm')}
                          </Button>
                        )}
                        {order.status === 'confirmed' && (
                          <Button size="sm" variant="primary">
                            {t('supplier.orders.complete')}
                          </Button>
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
        onOk={() => setShowConfirmModal(false)}
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

      {/* Handle Refund Modal */}
      <Modal
        open={showRefundModal}
        title={t('supplier.orders.handleRefund')}
        size="sm"
        onClose={() => setShowRefundModal(false)}
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setShowRefundModal(false)}>
              {t('supplier.orders.cancel')}
            </Button>
            <Button variant="danger" onClick={() => setShowRefundModal(false)}>
              {t('supplier.orders.reject')}
            </Button>
            <Button variant="primary" onClick={() => setShowRefundModal(false)}>
              {t('supplier.orders.approve')}
            </Button>
          </div>
        }
      >
        {selectedOrder && (
          <>
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 500 }}>
                {i18n.language === 'en' ? selectedOrder.productTitleEn : selectedOrder.productTitle}
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                {t('supplier.orders.amount')}: ¥{selectedOrder.amount}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                {t('supplier.orders.refundReason')}:
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                {i18n.language === 'zh' ? '行程有变，无法出行' : 'Schedule changed, unable to travel'}
              </p>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default SupplierOrderListPage;
