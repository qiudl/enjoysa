import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  Pagination,
  Loading,
  Modal,
} from '../../components/Common';
import { OrderList, OrderDetail } from '../../components/Order';
import type { Order, OrderStatus } from '../../types';
import { listOrders, type Order as ApiOrder } from '../../services/orderService';
import styles from './MyOrdersPage.module.css';

export interface MyOrdersPageProps {
  /** 当前语言 */
  language?: 'zh' | 'en';
  /** 用户名 */
  userName?: string;
  /** 用户头像 */
  userAvatar?: string;
  /** 购物车数量 */
  cartCount?: number;
  /** 加载中 */
  loading?: boolean;
  /** 订单点击 */
  onOrderClick?: (order: Order) => void;
  /** 登录点击 */
  onLoginClick?: () => void;
  /** 注册点击 */
  onRegisterClick?: () => void;
  /** 导航点击 */
  onNavClick?: (path: string) => void;
}

const statusMap: Record<string, OrderStatus> = {
  pending: 'pending_payment',
  paid: 'paid',
  accepted: 'confirmed',
  processing: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  refunded: 'refunded',
};

const paymentStatusMap: Record<string, 'unpaid' | 'paid' | 'refunding' | 'refunded'> = {
  pending: 'unpaid',
  paid: 'paid',
  accepted: 'paid',
  processing: 'paid',
  completed: 'paid',
  cancelled: 'unpaid',
  refunded: 'refunded',
};

function transformOrder(o: ApiOrder): Order {
  return {
    id: o.order_no || String(o.id),
    orderNumber: o.order_no || String(o.id),
    userId: String(o.user_id),
    items: [{
      id: `item-${o.id}`,
      productId: String(o.product_id),
      productTitle: o.product_name,
      productTitleEn: o.product_name,
      productImage: '',
      quantity: o.quantity || o.guest_count,
      unitPrice: o.unit_price,
      subtotal: o.total_price,
      travelDate: o.booking_date,
      participants: [{ type: 'adult' as const, count: o.guest_count || o.quantity }],
    }],
    status: statusMap[o.status] || 'pending_payment',
    totalAmount: o.total_price,
    currency: (o.currency || 'AUD') as 'AUD' | 'CNY',
    paymentMethod: o.payment_method as Order['paymentMethod'],
    paymentStatus: paymentStatusMap[o.status] || 'unpaid',
    contactInfo: {
      name: o.contact_name,
      phone: o.contact_phone,
      email: o.contact_email,
    },
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    paidAt: o.payment_time,
    completedAt: o.completed_at,
    cancelledAt: o.cancelled_at,
  };
}

// Map tab key to order statuses
const tabStatusMap: Record<string, OrderStatus[] | null> = {
  all: null,
  pending: ['pending_payment'],
  confirmed: ['paid', 'confirmed', 'in_progress'],
  completed: ['completed', 'cancelled', 'refunded', 'refund_requested'],
};

export const MyOrdersPage: React.FC<MyOrdersPageProps> = ({
  language,
  userName,
  userAvatar,
  cartCount = 0,
  loading = false,
  onOrderClick: onOrderClickProp,
  onLoginClick,
  onRegisterClick,
  onNavClick,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = language || (i18n.language?.startsWith('zh') ? 'zh' : 'en');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [orders, setOrders] = useState<Order[]>([]);
  const [apiLoading, setApiLoading] = useState(true);

  useEffect(() => {
    setApiLoading(true);
    listOrders({ page: 1, page_size: 50 })
      .then((result) => {
        setOrders((result.orders || []).map(transformOrder));
      })
      .catch(() => {})
      .finally(() => setApiLoading(false));
  }, []);

  const tabs = [
    { key: 'all', label: t('order.tabs.all') },
    { key: 'pending', label: t('order.tabs.pending') },
    { key: 'confirmed', label: t('order.tabs.confirmed') },
    { key: 'completed', label: t('order.tabs.completed') },
  ];

  // Filter orders based on tab
  const filteredOrders = activeTab === 'all'
    ? orders
    : orders.filter((order) => {
        const statuses = tabStatusMap[activeTab];
        return statuses ? statuses.includes(order.status) : true;
      });

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    onOrderClickProp?.(order);
  };

  const handleTabChange = (tab: 'all' | 'pending' | 'confirmed' | 'completed') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const getTabCount = (tabKey: string): number => {
    if (tabKey === 'all') return orders.length;
    const statuses = tabStatusMap[tabKey];
    if (!statuses) return 0;
    return orders.filter((o) => statuses.includes(o.status)).length;
  };

  return (
    <div className={styles.page}>
      <Header
        isLoggedIn
        userName={userName}
        userAvatar={userAvatar}
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
      />

      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>{t('nav.orders')}</h1>

          {/* Tabs */}
          <div className={styles.tabs}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.activeTab : ''}`}
                onClick={() => handleTabChange(tab.key as 'all' | 'pending' | 'confirmed' | 'completed')}
              >
                {tab.label}
                {tab.key !== 'all' && (
                  <span className={styles.tabCount}>
                    {getTabCount(tab.key)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Orders List */}
          {(loading || apiLoading) ? (
            <div className={styles.loadingContainer}>
              <Loading size="lg" />
            </div>
          ) : filteredOrders.length > 0 ? (
            <>
              <OrderList
                orders={filteredOrders}
                language={currentLang}
                activeTab={activeTab as 'all' | 'pending' | 'confirmed' | 'completed'}
                onOrderClick={handleOrderClick}
                onTabChange={handleTabChange}
              />

              {filteredOrders.length > pageSize && (
                <div className={styles.pagination}>
                  <Pagination
                    current={currentPage}
                    total={filteredOrders.length}
                    pageSize={pageSize}
                    language={currentLang}
                    onChange={(page) => setCurrentPage(page)}
                  />
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📦</span>
              <h3>{t('order.empty.title')}</h3>
              <p>{t('order.empty.description')}</p>
              <button className={styles.exploreBtn}>{t('order.empty.action')}</button>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Order Detail Modal */}
      <Modal
        open={!!selectedOrder}
        size="lg"
        hideFooter
        language={currentLang}
        onClose={() => setSelectedOrder(null)}
      >
        {selectedOrder && (
          <OrderDetail
            order={selectedOrder}
            language={currentLang}
          />
        )}
      </Modal>
    </div>
  );
};

export default MyOrdersPage;
