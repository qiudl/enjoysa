import React, { useState } from 'react';
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
  /** 当前语言 */
  language?: 'zh' | 'en';
  /** 供应商名称 */
  supplierName?: string;
}

const texts = {
  zh: {
    title: '订单管理',
    search: '搜索订单号或客户...',
    all: '全部',
    pending: '待处理',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消',
    refunding: '退款中',
    orderNo: '订单号',
    product: '产品',
    customer: '客户',
    travelDate: '出行日期',
    quantity: '人数',
    amount: '金额',
    status: '状态',
    actions: '操作',
    confirm: '确认订单',
    complete: '完成',
    viewDetail: '详情',
    handleRefund: '处理退款',
    confirmOrder: '确认订单',
    confirmOrderDesc: '确认后将向客户发送确认通知',
    cancel: '取消',
    approve: '同意退款',
    reject: '拒绝退款',
    refundReason: '退款原因',
    customerInfo: '客户信息',
    phone: '电话',
    noOrders: '暂无订单',
    statusLabels: {
      pending: '待处理',
      confirmed: '已确认',
      completed: '已完成',
      cancelled: '已取消',
      refunding: '退款中',
    },
  },
  en: {
    title: 'Order Management',
    search: 'Search order or customer...',
    all: 'All',
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    refunding: 'Refunding',
    orderNo: 'Order No.',
    product: 'Product',
    customer: 'Customer',
    travelDate: 'Travel Date',
    quantity: 'Guests',
    amount: 'Amount',
    status: 'Status',
    actions: 'Actions',
    confirm: 'Confirm',
    complete: 'Complete',
    viewDetail: 'Detail',
    handleRefund: 'Handle Refund',
    confirmOrder: 'Confirm Order',
    confirmOrderDesc: 'Customer will receive confirmation notification',
    cancel: 'Cancel',
    approve: 'Approve Refund',
    reject: 'Reject Refund',
    refundReason: 'Refund Reason',
    customerInfo: 'Customer Info',
    phone: 'Phone',
    noOrders: 'No orders yet',
    statusLabels: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled',
      refunding: 'Refunding',
    },
  },
};

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
    productTitle: '巴罗莎谷酒庄之旅',
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
  language = 'zh',
  supplierName = '祥龙旅行社',
}) => {
  const txt = texts[language];
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null);

  const filters = [
    { key: 'all', label: txt.all },
    { key: 'pending', label: txt.pending },
    { key: 'confirmed', label: txt.confirmed },
    { key: 'completed', label: txt.completed },
    { key: 'refunding', label: txt.refunding },
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
            <h1 className={styles.pageTitle}>{txt.title}</h1>
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
                placeholder={txt.search}
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
                        {txt.statusLabels[order.status]}
                      </span>
                    </div>
                    <div className={styles.orderBody}>
                      <div className={styles.orderInfo}>
                        <h3 className={styles.productTitle}>
                          {language === 'en' ? order.productTitleEn : order.productTitle}
                        </h3>
                        <div className={styles.orderMeta}>
                          <span>{txt.travelDate}: {order.travelDate}</span>
                          <span>{txt.quantity}: {order.quantity}{language === 'zh' ? '人' : ' guests'}</span>
                        </div>
                        <div className={styles.customerInfo}>
                          <span>{order.customerName}</span>
                          <span>{order.customerPhone}</span>
                        </div>
                      </div>
                      <div className={styles.orderAmount}>
                        <span className={styles.amountLabel}>{txt.amount}</span>
                        <span className={styles.amountValue}>¥{order.amount}</span>
                      </div>
                    </div>
                    <div className={styles.orderFooter}>
                      <span className={styles.orderTime}>{order.createdAt}</span>
                      <div className={styles.orderActions}>
                        <Button size="sm" variant="outline">
                          {txt.viewDetail}
                        </Button>
                        {order.status === 'pending' && (
                          <Button size="sm" variant="primary" onClick={() => handleConfirm(order)}>
                            {txt.confirm}
                          </Button>
                        )}
                        {order.status === 'confirmed' && (
                          <Button size="sm" variant="primary">
                            {txt.complete}
                          </Button>
                        )}
                        {order.status === 'refunding' && (
                          <Button size="sm" variant="danger" onClick={() => handleRefund(order)}>
                            {txt.handleRefund}
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
              <p className={styles.emptyText}>{txt.noOrders}</p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Confirm Order Modal */}
      <Modal
        open={showConfirmModal}
        title={txt.confirmOrder}
        size="sm"
        language={language}
        onClose={() => setShowConfirmModal(false)}
        onOk={() => setShowConfirmModal(false)}
      >
        <p>{txt.confirmOrderDesc}</p>
        {selectedOrder && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 500 }}>
              {language === 'en' ? selectedOrder.productTitleEn : selectedOrder.productTitle}
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
              {txt.customer}: {selectedOrder.customerName} | {txt.travelDate}: {selectedOrder.travelDate}
            </p>
          </div>
        )}
      </Modal>

      {/* Handle Refund Modal */}
      <Modal
        open={showRefundModal}
        title={txt.handleRefund}
        size="sm"
        language={language}
        onClose={() => setShowRefundModal(false)}
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setShowRefundModal(false)}>
              {txt.cancel}
            </Button>
            <Button variant="danger" onClick={() => setShowRefundModal(false)}>
              {txt.reject}
            </Button>
            <Button variant="primary" onClick={() => setShowRefundModal(false)}>
              {txt.approve}
            </Button>
          </div>
        }
      >
        {selectedOrder && (
          <>
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 500 }}>
                {language === 'en' ? selectedOrder.productTitleEn : selectedOrder.productTitle}
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                {txt.amount}: ¥{selectedOrder.amount}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                {txt.refundReason}:
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                {language === 'zh' ? '行程有变，无法出行' : 'Schedule changed, unable to travel'}
              </p>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default SupplierOrderListPage;
