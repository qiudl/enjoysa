import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  User as UserIcon,
  ShoppingBag,
  Heart,
  MessageSquare,
  Settings,
  ChevronRight,
  LogOut
} from 'lucide-react';
import type { User } from '../../../types';
import styles from './UserProfile.module.css';

export interface UserProfileProps {
  /** 用户信息 */
  user: User;
  /** 订单数量 */
  orderCount?: number;
  /** 收藏数量 */
  favoriteCount?: number;
  /** 评价数量 */
  reviewCount?: number;
  /** 点击订单 */
  onOrdersClick?: () => void;
  /** 点击收藏 */
  onFavoritesClick?: () => void;
  /** 点击评价 */
  onReviewsClick?: () => void;
  /** 点击设置 */
  onSettingsClick?: () => void;
  /** 点击编辑资料 */
  onEditProfile?: () => void;
  /** 退出登录 */
  onLogout?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  orderCount = 0,
  favoriteCount = 0,
  reviewCount = 0,
  onOrdersClick,
  onFavoritesClick,
  onReviewsClick,
  onSettingsClick,
  onEditProfile,
  onLogout,
}) => {
  const { t } = useTranslation();

  const menuItems = [
    {
      icon: <ShoppingBag size={20} />,
      label: t('user.orders'),
      onClick: onOrdersClick,
    },
    {
      icon: <Heart size={20} />,
      label: t('user.favorites'),
      onClick: onFavoritesClick,
    },
    {
      icon: <MessageSquare size={20} />,
      label: t('user.reviews'),
      onClick: onReviewsClick,
    },
    {
      icon: <Settings size={20} />,
      label: t('user.settings'),
      onClick: onSettingsClick,
    },
  ];

  return (
    <div className={styles.container}>
      {/* 用户头部信息 */}
      <div className={styles.header}>
        <div className={styles.avatarWrapper}>
          {user.avatar ? (
            <img src={user.avatar} alt={user.nickname} className={styles.avatar} />
          ) : (
            <div className={styles.avatarPlaceholder}>
              <UserIcon size={32} />
            </div>
          )}
        </div>
        <div className={styles.userInfo}>
          <h2 className={styles.nickname}>{user.nickname}</h2>
          <p className={styles.contact}>
            {user.phone || user.email}
          </p>
        </div>
        <button className={styles.editButton} onClick={onEditProfile}>
          {t('user.editProfile')}
        </button>
      </div>

      {/* 统计数据 */}
      <div className={styles.stats}>
        <button className={styles.statItem} onClick={onOrdersClick}>
          <span className={styles.statValue}>{orderCount}</span>
          <span className={styles.statLabel}>{t('user.orderCount')}</span>
        </button>
        <button className={styles.statItem} onClick={onFavoritesClick}>
          <span className={styles.statValue}>{favoriteCount}</span>
          <span className={styles.statLabel}>{t('user.favoriteCount')}</span>
        </button>
        <button className={styles.statItem} onClick={onReviewsClick}>
          <span className={styles.statValue}>{reviewCount}</span>
          <span className={styles.statLabel}>{t('user.reviewCount')}</span>
        </button>
      </div>

      {/* 菜单列表 */}
      <div className={styles.menu}>
        {menuItems.map((item, index) => (
          <button
            key={index}
            className={styles.menuItem}
            onClick={item.onClick}
          >
            <span className={styles.menuIcon}>{item.icon}</span>
            <span className={styles.menuLabel}>{item.label}</span>
            <ChevronRight size={18} className={styles.menuArrow} />
          </button>
        ))}
      </div>

      {/* 退出登录 */}
      <button className={styles.logoutButton} onClick={onLogout}>
        <LogOut size={18} />
        {t('auth.logout')}
      </button>
    </div>
  );
};

export default UserProfile;
