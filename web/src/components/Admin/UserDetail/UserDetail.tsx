import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  ShoppingCart,
  DollarSign,
  Ban,
  Unlock,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';
import type { UserData, UserStatus } from '../UserTable';
import styles from './UserDetail.module.css';

export interface UserDetailProps {
  user: UserData | null;
  open: boolean;
  onClose: () => void;
  onBan?: (user: UserData, reason: string) => void;
  onUnban?: (user: UserData) => void;
}

export const UserDetail: React.FC<UserDetailProps> = ({
  user,
  open,
  onClose,
  onBan,
  onUnban,
}) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'info' | 'orders'>('info');
  const [banReason, setBanReason] = useState('');
  const [showBanModal, setShowBanModal] = useState(false);

  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  if (!open || !user) return null;

  const getStatusLabel = (status: UserStatus) => {
    const labels: Record<UserStatus, string> = {
      active: t('admin.users.status.active'),
      inactive: t('admin.users.status.inactive'),
      banned: t('admin.users.status.banned'),
    };
    return labels[status];
  };

  const formatPrice = (price: number) => {
    return `A$${price.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleBan = () => {
    if (banReason.trim() && onBan) {
      onBan(user, banReason);
      setShowBanModal(false);
      setBanReason('');
    }
  };

  const tabs = [
    { key: 'info', label: t('admin.users.detail.tabs.info') },
    { key: 'orders', label: t('admin.users.detail.tabs.orders') },
  ];

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('admin.users.detail.title')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.userHeader}>
          <div className={styles.userInfo}>
            {user.avatar ? (
              <img src={user.avatar} alt="" className={styles.avatar} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                <User size={32} />
              </div>
            )}
            <div className={styles.userMeta}>
              <h3 className={styles.userName}>{user.name}</h3>
              <span className={clsx(styles.statusBadge, styles[user.status])}>
                {getStatusLabel(user.status)}
              </span>
            </div>
          </div>

          <div className={styles.stats}>
            <div className={styles.statItem}>
              <ShoppingCart size={16} />
              <span className={styles.statValue}>{user.orderCount}</span>
              <span className={styles.statLabel}>{t('admin.users.detail.orders')}</span>
            </div>
            <div className={styles.statItem}>
              <DollarSign size={16} />
              <span className={styles.statValue}>{formatPrice(user.totalSpent)}</span>
              <span className={styles.statLabel}>{t('admin.users.detail.spent')}</span>
            </div>
          </div>
        </div>

        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={clsx(styles.tab, activeTab === tab.key && styles.active)}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {activeTab === 'info' && (
            <div className={styles.infoSection}>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Mail size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.users.detail.email')}</span>
                    <span className={styles.infoValue}>{user.email}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Phone size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.users.detail.phone')}</span>
                    <span className={styles.infoValue}>{user.phone || '-'}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Calendar size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.users.detail.registerDate')}</span>
                    <span className={styles.infoValue}>{formatDate(user.createdAt)}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Clock size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.users.detail.lastLogin')}</span>
                    <span className={styles.infoValue}>
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className={styles.ordersSection}>
              {user.orderCount > 0 ? (
                <div className={styles.orderList}>
                  {/* Mock order history */}
                  {[
                    { id: '1', orderNo: 'ORD202602010001', product: '袋鼠岛一日游', amount: 598, status: 'completed', date: '2026-02-01' },
                    { id: '2', orderNo: 'ORD202601280002', product: '巴罗莎谷品酒之旅', amount: 756, status: 'completed', date: '2026-01-28' },
                    { id: '3', orderNo: 'ORD202601150003', product: '阿德莱德城市观光', amount: 267, status: 'cancelled', date: '2026-01-15' },
                  ].slice(0, Math.min(user.orderCount, 3)).map((order) => (
                    <div key={order.id} className={styles.orderItem}>
                      <div className={styles.orderInfo}>
                        <span className={styles.orderNo}>{order.orderNo}</span>
                        <span className={styles.orderProduct}>{order.product}</span>
                      </div>
                      <div className={styles.orderMeta}>
                        <span className={styles.orderAmount}>{formatPrice(order.amount)}</span>
                        <span className={clsx(styles.orderStatus, styles[order.status])}>
                          {order.status === 'completed' ? t('admin.orders.status.completed') : t('admin.orders.status.cancelled')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.placeholder}>
                  <ShoppingCart size={48} />
                  <p>{t('admin.users.detail.ordersPlaceholder')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {user.status !== 'banned' ? (
            <button
              className={clsx(styles.btn, styles.btnBan)}
              onClick={() => setShowBanModal(true)}
            >
              <Ban size={16} />
              <span>{t('admin.users.actions.ban')}</span>
            </button>
          ) : (
            <button
              className={clsx(styles.btn, styles.btnUnban)}
              onClick={() => onUnban?.(user)}
            >
              <Unlock size={16} />
              <span>{t('admin.users.actions.unban')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Ban Modal */}
      {showBanModal && (
        <>
          <div className={styles.modalOverlay} onClick={() => setShowBanModal(false)} />
          <div className={styles.modal}>
            <h3>{t('admin.users.ban.title')}</h3>
            <p>{t('admin.users.ban.message')}</p>
            <textarea
              className={styles.textarea}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder={t('admin.users.ban.placeholder')}
              rows={4}
            />
            <div className={styles.modalActions}>
              <button
                className={clsx(styles.btn, styles.btnSecondary)}
                onClick={() => setShowBanModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className={clsx(styles.btn, styles.btnBan)}
                onClick={handleBan}
                disabled={!banReason.trim()}
              >
                {t('admin.users.actions.ban')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default UserDetail;
