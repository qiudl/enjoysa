import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  Button,
  Modal,
} from '../../components/Common';
import type { Order, ContactInfo } from '../../types';
import styles from './UserProfilePage.module.css';

export interface UserProfilePageProps {
  /** 当前语言 */
  language?: 'zh' | 'en';
  /** 用户名 */
  userName?: string;
  /** 用户头像 */
  userAvatar?: string;
  /** 购物车数量 */
  cartCount?: number;
  /** 用户邮箱 */
  userEmail?: string;
  /** 用户手机 */
  userPhone?: string;
  /** 会员等级 */
  memberLevel?: 'normal' | 'silver' | 'gold' | 'platinum';
  /** 积分 */
  points?: number;
  /** 优惠券数量 */
  couponCount?: number;
  /** 收藏数量 */
  favoriteCount?: number;
  /** 退出登录 */
  onLogout?: () => void;
  /** 编辑资料 */
  onEditProfile?: () => void;
  /** 登录点击 */
  onLoginClick?: () => void;
  /** 注册点击 */
  onRegisterClick?: () => void;
  /** 导航点击 */
  onNavClick?: (path: string) => void;
}

// Mock order data
const mockContactInfo: ContactInfo = {
  name: '张三',
  phone: '13800138000',
  email: 'zhangsan@example.com',
};

const mockRecentOrders: Order[] = [
  {
    id: 'ORD-20260215-0001',
    orderNumber: 'ORD-20260215-0001',
    userId: 'user-1',
    items: [{
      id: 'item-1',
      productId: '1',
      productTitle: '袋鼠岛一日游',
      productTitleEn: 'Kangaroo Island Day Tour',
      productImage: 'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=400',
      quantity: 2,
      unitPrice: 389,
      subtotal: 778,
      travelDate: '2026-02-20',
      participants: [{ type: 'adult', name: '张三', count: 2 }],
    }],
    status: 'confirmed',
    totalAmount: 778,
    currency: 'CNY',
    paymentMethod: 'wechat',
    paymentStatus: 'paid',
    contactInfo: mockContactInfo,
    createdAt: '2026-02-15T10:30:00Z',
    updatedAt: '2026-02-15T10:35:00Z',
    paidAt: '2026-02-15T10:32:00Z',
  },
  {
    id: 'ORD-20260210-0002',
    orderNumber: 'ORD-20260210-0002',
    userId: 'user-1',
    items: [{
      id: 'item-2',
      productId: '2',
      productTitle: '巴罗萨谷酒庄之旅',
      productTitleEn: 'Barossa Valley Winery Tour',
      productImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
      quantity: 4,
      unitPrice: 299,
      subtotal: 1196,
      travelDate: '2026-02-12',
      participants: [{ type: 'adult', name: '李四', count: 4 }],
    }],
    status: 'completed',
    totalAmount: 1196,
    currency: 'CNY',
    paymentMethod: 'alipay',
    paymentStatus: 'paid',
    contactInfo: mockContactInfo,
    createdAt: '2026-02-08T14:20:00Z',
    updatedAt: '2026-02-12T18:00:00Z',
    paidAt: '2026-02-08T14:25:00Z',
    completedAt: '2026-02-12T18:00:00Z',
  },
];

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  language = 'zh',
  userName = '张三',
  userAvatar,
  cartCount = 0,
  userEmail = 'zhangsan@example.com',
  userPhone = '138****8000',
  memberLevel = 'gold',
  points = 2580,
  couponCount = 3,
  favoriteCount = 12,
  onLogout,
  onEditProfile,
  onLoginClick,
  onRegisterClick,
  onNavClick,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = language || (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(false);
    onLogout?.();
  };

  const orderStats = [
    { key: 'pending', count: 1, icon: '💳' },
    { key: 'confirmed', count: 2, icon: '✈️' },
    { key: 'completed', count: 5, icon: '✅' },
    { key: 'refund', count: 0, icon: '↩️' },
  ];

  const quickActions = [
    { key: 'favorites', label: t('nav.favorites'), icon: '❤️', count: favoriteCount },
    { key: 'coupons', label: t('user.coupons'), icon: '🎫', count: couponCount },
    { key: 'points', label: t('user.myPoints'), icon: '⭐', count: points },
    { key: 'settings', label: t('user.settings'), icon: '⚙️' },
    { key: 'help', label: t('user.helpCenter'), icon: '❓' },
  ];

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending_payment: t('user.orderStats.pending'),
      confirmed: t('user.orderStats.confirmed'),
      completed: t('user.orderStats.completed'),
    };
    return statusMap[status] || status;
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
          {/* Profile Header */}
          <section className={styles.profileHeader}>
            <div className={styles.avatarSection}>
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className={styles.avatar} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {userName.charAt(0)}
                </div>
              )}
              <div className={styles.levelBadge} data-level={memberLevel}>
                {t(`user.memberLevel.${memberLevel}`)}
              </div>
            </div>
            <div className={styles.userInfo}>
              <h1 className={styles.userName}>{userName}</h1>
              <p className={styles.userContact}>{userPhone}</p>
              <p className={styles.userContact}>{userEmail}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onEditProfile}>
              {t('user.editProfile')}
            </Button>
          </section>

          {/* Order Stats */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{t('nav.orders')}</h2>
              <button className={styles.viewAllBtn}>{t('common.viewAll')} →</button>
            </div>
            <div className={styles.orderStats}>
              {orderStats.map((stat) => (
                <div key={stat.key} className={styles.statItem}>
                  <span className={styles.statIcon}>{stat.icon}</span>
                  <span className={styles.statCount}>{stat.count}</span>
                  <span className={styles.statLabel}>
                    {t(`user.orderStats.${stat.key}`)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Orders */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('user.recentOrders')}</h2>
            {mockRecentOrders.length > 0 ? (
              <div className={styles.orderList}>
                {mockRecentOrders.map((order) => (
                  <div key={order.id} className={styles.orderCard}>
                    <div className={styles.orderHeader}>
                      <span className={styles.orderNumber}>{order.orderNumber}</span>
                      <span className={styles.orderStatus} data-status={order.status}>
                        {getStatusText(order.status)}
                      </span>
                    </div>
                    {order.items.map((item) => (
                      <div key={item.id} className={styles.orderItem}>
                        <img
                          src={item.productImage}
                          alt={item.productTitle}
                          className={styles.orderImage}
                        />
                        <div className={styles.orderInfo}>
                          <h4 className={styles.orderTitle}>
                            {currentLang === 'en' && item.productTitleEn
                              ? item.productTitleEn
                              : item.productTitle}
                          </h4>
                          <p className={styles.orderDate}>
                            {t('user.travelDate')}: {item.travelDate}
                          </p>
                          <p className={styles.orderQuantity}>
                            {item.quantity} {t('user.guests')}
                          </p>
                        </div>
                        <div className={styles.orderPrice}>
                          ¥{order.totalAmount}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyOrders}>
                <span className={styles.emptyIcon}>📦</span>
                <p>{t('user.noOrders')}</p>
                <p className={styles.emptyHint}>{t('user.startExploring')}</p>
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('user.quickActions')}</h2>
            <div className={styles.quickActions}>
              {quickActions.map((action) => (
                <button key={action.key} className={styles.actionItem}>
                  <span className={styles.actionIcon}>{action.icon}</span>
                  <span className={styles.actionLabel}>{action.label}</span>
                  {action.count !== undefined && (
                    <span className={styles.actionCount}>{action.count}</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Logout Button */}
          <div className={styles.logoutSection}>
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowLogoutModal(true)}
            >
              {t('auth.logout')}
            </Button>
          </div>
        </div>
      </main>

      <Footer />

      {/* Logout Confirmation Modal */}
      <Modal
        open={showLogoutModal}
        title={t('auth.logout')}
        size="sm"
        language={language}
        onClose={() => setShowLogoutModal(false)}
        onOk={handleLogout}
      >
        <p>{t('user.logoutConfirm')}</p>
      </Modal>
    </div>
  );
};

export default UserProfilePage;
