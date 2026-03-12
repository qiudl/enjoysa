import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  Pagination,
  Loading,
  Modal,
} from '../../components/Common';
import { OrderList, OrderDetail } from '../../components/Order';
import type { Order, OrderStatus, OrderItem, ContactInfo } from '../../types';
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

// Mock order items
const createMockOrderItem = (
  productId: string,
  productTitle: string,
  productTitleEn: string,
  quantity: number,
  unitPrice: number
): OrderItem => ({
  id: `item-${productId}`,
  productId,
  productTitle,
  productTitleEn,
  productImage: `https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=400`,
  quantity,
  unitPrice,
  subtotal: unitPrice * quantity,
  travelDate: '2026-02-15',
  participants: [
    {
      type: 'adult',
      name: '张三',
      count: quantity,
    },
  ],
});

// Mock contact info
const mockContactInfo: ContactInfo = {
  name: '张三',
  phone: '13800138000',
  email: 'zhangsan@example.com',
};

// Mock orders data
const mockOrders: Order[] = [
  {
    id: 'ORD-20260215-0001',
    orderNumber: 'ORD-20260215-0001',
    userId: 'user-1',
    items: [createMockOrderItem('1', '袋鼠岛一日游', 'Kangaroo Island Day Tour', 2, 389)],
    status: 'completed',
    totalAmount: 778,
    currency: 'CNY',
    paymentMethod: 'wechat',
    paymentStatus: 'paid',
    contactInfo: mockContactInfo,
    createdAt: '2026-02-10T14:30:00Z',
    updatedAt: '2026-02-15T18:00:00Z',
    paidAt: '2026-02-10T14:35:00Z',
  },
  {
    id: 'ORD-20260220-0002',
    orderNumber: 'ORD-20260220-0002',
    userId: 'user-1',
    items: [createMockOrderItem('2', '巴罗萨谷酒庄之旅', 'Barossa Valley Winery Tour', 4, 299)],
    status: 'confirmed',
    totalAmount: 1196,
    currency: 'CNY',
    paymentMethod: 'alipay',
    paymentStatus: 'paid',
    contactInfo: mockContactInfo,
    createdAt: '2026-02-12T10:15:00Z',
    updatedAt: '2026-02-12T10:20:00Z',
    paidAt: '2026-02-12T10:18:00Z',
  },
  {
    id: 'ORD-20260225-0003',
    orderNumber: 'ORD-20260225-0003',
    userId: 'user-1',
    items: [createMockOrderItem('3', '海豚巡航体验', 'Dolphin Cruise Experience', 3, 159)],
    status: 'pending_payment',
    totalAmount: 477,
    currency: 'CNY',
    paymentStatus: 'unpaid',
    contactInfo: mockContactInfo,
    createdAt: '2026-02-14T16:45:00Z',
    updatedAt: '2026-02-14T16:45:00Z',
  },
  {
    id: 'ORD-20260301-0004',
    orderNumber: 'ORD-20260301-0004',
    userId: 'user-1',
    items: [createMockOrderItem('4', '阿德莱德城市观光', 'Adelaide City Sightseeing', 2, 129)],
    status: 'cancelled',
    totalAmount: 258,
    currency: 'CNY',
    paymentStatus: 'unpaid',
    contactInfo: mockContactInfo,
    createdAt: '2026-02-15T09:20:00Z',
    updatedAt: '2026-02-15T10:00:00Z',
  },
];


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

  const tabs = [
    { key: 'all', label: t('order.tabs.all') },
    { key: 'pending', label: t('order.tabs.pending') },
    { key: 'confirmed', label: t('order.tabs.confirmed') },
    { key: 'completed', label: t('order.tabs.completed') },
  ];

  // Filter orders based on tab
  const filteredOrders = activeTab === 'all'
    ? mockOrders
    : mockOrders.filter((order) => {
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
    if (tabKey === 'all') return mockOrders.length;
    const statuses = tabStatusMap[tabKey];
    if (!statuses) return 0;
    return mockOrders.filter((o) => statuses.includes(o.status)).length;
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
          {loading ? (
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
