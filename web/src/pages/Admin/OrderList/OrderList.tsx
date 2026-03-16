import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download } from 'lucide-react';
import clsx from 'clsx';
import { OrderStats } from '../../../components/Admin/OrderStats';
import type { OrderStatsData } from '../../../components/Admin/OrderStats';
import { OrderTable } from '../../../components/Admin/OrderTable';
import type { Order, OrderStatus } from '../../../components/Admin/OrderTable';
import { OrderDetail } from '../../../components/Admin/OrderDetail';
import { adminService, type ApiOrder } from '../../../services/adminService';
import styles from './OrderList.module.css';

function transformOrder(o: ApiOrder): Order {
  return {
    id: String(o.id),
    orderNo: o.order_no,
    customerName: o.contact_name || o.user_name,
    customerPhone: o.contact_phone || o.user_phone,
    customerEmail: o.contact_email || o.user_email,
    productId: String(o.product_id),
    productName: o.product_name,
    supplierId: String(o.supplier_id),
    supplierName: o.supplier_name,
    travelDate: o.booking_date,
    quantity: o.quantity,
    amount: o.total_price,
    status: o.status as OrderStatus,
    createdAt: o.created_at,
    paidAt: o.payment_time,
    confirmedAt: o.accepted_at,
    completedAt: o.completed_at,
    cancelledAt: o.cancelled_at,
    cancelReason: o.cancel_reason,
  };
}

const defaultStats: OrderStatsData = {
  total: 0,
  pending: 0,
  confirmed: 0,
  completed: 0,
  cancelled: 0,
  todayOrders: 0,
};

type TabKey = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunding';

export const OrderList: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStatsData>(defaultStats);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await adminService.listOrders({ page: 1, page_size: 50 });
      const items = (result.items || []).map(transformOrder);
      setOrders(items);
      const pending = items.filter((o) => o.status === 'pending').length;
      const confirmed = items.filter((o) => o.status === 'confirmed').length;
      const completed = items.filter((o) => o.status === 'completed').length;
      const cancelled = items.filter((o) => o.status === 'cancelled').length;
      setStats({ total: result.total, pending, confirmed, completed, cancelled, todayOrders: 0 });
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all', label: t('admin.orders.tabs.all'), count: stats.total },
    { key: 'pending', label: t('admin.orders.tabs.pending'), count: stats.pending },
    { key: 'confirmed', label: t('admin.orders.tabs.confirmed'), count: stats.confirmed },
    { key: 'completed', label: t('admin.orders.tabs.completed'), count: stats.completed },
    { key: 'cancelled', label: t('admin.orders.tabs.cancelled'), count: stats.cancelled },
  ];

  const filteredOrders = orders.filter((order) => {
    // Filter by tab
    if (activeTab !== 'all' && order.status !== activeTab) {
      return false;
    }
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        order.orderNo.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.productName.toLowerCase().includes(query) ||
        order.supplierName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleView = (order: Order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const handleConfirm = async (order: Order) => {
    // API call to confirm
    console.log('Confirm order:', order.id);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, status: 'confirmed' as OrderStatus, confirmedAt: new Date().toISOString() }
          : o
      )
    );
    setDetailOpen(false);
  };

  const handleCancel = async (order: Order, reason: string) => {
    // API call to cancel
    console.log('Cancel order:', order.id, 'Reason:', reason);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, status: 'cancelled' as OrderStatus, cancelledAt: new Date().toISOString(), cancelReason: reason }
          : o
      )
    );
    setDetailOpen(false);
  };

  const handleApproveRefund = async (order: Order) => {
    // API call to approve refund
    console.log('Approve refund:', order.id);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, status: 'cancelled' as OrderStatus, cancelledAt: new Date().toISOString(), cancelReason: '退款成功' }
          : o
      )
    );
    setDetailOpen(false);
  };

  const handleRejectRefund = async (order: Order, reason: string) => {
    // API call to reject refund
    console.log('Reject refund:', order.id, 'Reason:', reason);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, status: 'confirmed' as OrderStatus }
          : o
      )
    );
    setDetailOpen(false);
  };

  const handleStatClick = (status: string) => {
    if (status === 'total') {
      setActiveTab('all');
    } else {
      setActiveTab(status as TabKey);
    }
  };

  return (
    <div className={styles.page}>
      {/* Stats */}
      <OrderStats data={stats} loading={loading} onStatClick={handleStatClick} />

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* Tabs */}
          <div className={styles.tabs}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={clsx(styles.tab, activeTab === tab.key && styles.active)}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={styles.tabCount}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          {/* Search */}
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t('admin.orders.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Actions */}
          <button className={styles.iconBtn} onClick={loadData} title={t('common.refresh')}>
            <RefreshCw size={18} />
          </button>
          <button className={styles.iconBtn} title={t('admin.orders.export')}>
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Table */}
      <OrderTable
        orders={filteredOrders}
        loading={loading}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        onView={handleView}
        onConfirm={handleConfirm}
        onCancel={(o) => handleCancel(o, '')}
        onRefund={handleView}
      />

      {/* Pagination */}
      {!loading && filteredOrders.length > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            {t('admin.orders.showing', {
              from: 1,
              to: filteredOrders.length,
              total: filteredOrders.length,
            })}
          </span>
        </div>
      )}

      {/* Detail Drawer */}
      <OrderDetail
        order={selectedOrder}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onApproveRefund={handleApproveRefund}
        onRejectRefund={handleRejectRefund}
      />
    </div>
  );
};

export default OrderList;
