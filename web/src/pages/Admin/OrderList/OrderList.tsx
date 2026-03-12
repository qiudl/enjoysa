import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download } from 'lucide-react';
import clsx from 'clsx';
import { OrderStats } from '../../../components/Admin/OrderStats';
import type { OrderStatsData } from '../../../components/Admin/OrderStats';
import { OrderTable } from '../../../components/Admin/OrderTable';
import type { Order, OrderStatus } from '../../../components/Admin/OrderTable';
import { OrderDetail } from '../../../components/Admin/OrderDetail';
import styles from './OrderList.module.css';

// Mock data for demonstration
const mockOrders: Order[] = [
  {
    id: '1',
    orderNo: 'ORD202602010001',
    customerName: '张三',
    customerPhone: '+86 138 0000 0001',
    customerEmail: 'zhang@example.com',
    productId: '1',
    productName: '袋鼠岛一日游',
    supplierId: '1',
    supplierName: '祥龙旅行社',
    travelDate: '2026-02-15',
    quantity: 2,
    amount: 598,
    status: 'pending',
    createdAt: '2026-02-01T10:30:00Z',
  },
  {
    id: '2',
    orderNo: 'ORD202601300002',
    customerName: '李四',
    customerPhone: '+61 412 000 002',
    customerEmail: 'li@example.com',
    productId: '2',
    productName: '巴罗萨谷品酒之旅',
    supplierId: '1',
    supplierName: '祥龙旅行社',
    travelDate: '2026-02-10',
    quantity: 4,
    amount: 756,
    status: 'confirmed',
    createdAt: '2026-01-30T14:20:00Z',
    paidAt: '2026-01-30T14:25:00Z',
    confirmedAt: '2026-01-30T15:00:00Z',
  },
  {
    id: '3',
    orderNo: 'ORD202601280003',
    customerName: '王五',
    customerPhone: '+86 139 0000 0003',
    customerEmail: 'wang@example.com',
    productId: '3',
    productName: '阿德莱德城市观光',
    supplierId: '2',
    supplierName: '阳光旅游',
    travelDate: '2026-01-29',
    quantity: 3,
    amount: 267,
    status: 'completed',
    createdAt: '2026-01-28T09:00:00Z',
    paidAt: '2026-01-28T09:05:00Z',
    confirmedAt: '2026-01-28T10:00:00Z',
    completedAt: '2026-01-29T18:00:00Z',
  },
  {
    id: '4',
    orderNo: 'ORD202601250004',
    customerName: '赵六',
    customerPhone: '+61 423 000 004',
    customerEmail: 'zhao@example.com',
    productId: '1',
    productName: '袋鼠岛一日游',
    supplierId: '1',
    supplierName: '祥龙旅行社',
    travelDate: '2026-01-28',
    quantity: 2,
    amount: 598,
    status: 'cancelled',
    createdAt: '2026-01-25T11:30:00Z',
    paidAt: '2026-01-25T11:35:00Z',
    cancelledAt: '2026-01-26T09:00:00Z',
    cancelReason: '客户行程变更',
  },
  {
    id: '5',
    orderNo: 'ORD202602020005',
    customerName: '孙七',
    customerPhone: '+86 137 0000 0005',
    customerEmail: 'sun@example.com',
    productId: '4',
    productName: '克莱兰德野生动物园门票',
    supplierId: '3',
    supplierName: '袋鼠岛景区',
    travelDate: '2026-02-05',
    quantity: 5,
    amount: 175,
    status: 'refunding',
    createdAt: '2026-02-02T08:00:00Z',
    paidAt: '2026-02-02T08:05:00Z',
    confirmedAt: '2026-02-02T09:00:00Z',
  },
];

const mockStats: OrderStatsData = {
  total: 1256,
  pending: 23,
  confirmed: 89,
  completed: 1108,
  cancelled: 36,
  todayOrders: 12,
};

type TabKey = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunding';

export const OrderList: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStatsData>(mockStats);
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
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setOrders(mockOrders);
    setStats(mockStats);
    setLoading(false);
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
