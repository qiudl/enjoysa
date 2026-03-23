import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, ShoppingCart, Settings, DollarSign, Check } from 'lucide-react';
import styles from './NotificationPanel.module.css';

interface Notification {
  id: string;
  type: 'order' | 'system' | 'settlement';
  titleKey: string;
  descKey: string;
  time: string;
  read: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'order',
    titleKey: 'supplier.notifications.newOrder',
    descKey: 'supplier.notifications.newOrderDesc',
    time: '5m',
    read: false,
  },
  {
    id: 'n2',
    type: 'system',
    titleKey: 'supplier.notifications.systemUpdate',
    descKey: 'supplier.notifications.systemUpdateDesc',
    time: '30m',
    read: false,
  },
  {
    id: 'n3',
    type: 'settlement',
    titleKey: 'supplier.notifications.paymentReceived',
    descKey: 'supplier.notifications.paymentReceivedDesc',
    time: '2h',
    read: false,
  },
  {
    id: 'n4',
    type: 'order',
    titleKey: 'supplier.notifications.orderCancelled',
    descKey: 'supplier.notifications.orderCancelledDesc',
    time: '5h',
    read: true,
  },
  {
    id: 'n5',
    type: 'system',
    titleKey: 'supplier.notifications.maintenance',
    descKey: 'supplier.notifications.maintenanceDesc',
    time: '1d',
    read: true,
  },
];

const typeIcons: Record<string, React.ReactNode> = {
  order: <ShoppingCart size={16} />,
  system: <Settings size={16} />,
  settlement: <DollarSign size={16} />,
};

const typeColors: Record<string, string> = {
  order: '#3b82f6',
  system: '#8b5cf6',
  settlement: '#10b981',
};

export const NotificationPanel: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <div ref={panelRef} className={styles.wrapper}>
      <button
        className={`${styles.bellBtn} ${unreadCount > 0 ? styles.hasUnread : ''}`}
        onClick={() => setOpen(!open)}
        title={t('supplier.notifications.title')}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderLeft}>
              <span className={styles.panelTitle}>{t('supplier.notifications.title')}</span>
              {unreadCount > 0 && (
                <span className={styles.unreadBadge}>
                  {unreadCount} {t('supplier.notifications.unread')}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
                <Check size={14} />
                {t('supplier.notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>
                <Bell size={32} className={styles.emptyIcon} />
                <p className={styles.emptyText}>{t('supplier.notifications.empty')}</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`${styles.item} ${!notification.read ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  <div
                    className={styles.itemIcon}
                    style={{
                      backgroundColor: `${typeColors[notification.type]}15`,
                      color: typeColors[notification.type],
                    }}
                  >
                    {typeIcons[notification.type]}
                  </div>
                  <div className={styles.itemContent}>
                    <span className={styles.itemTitle}>{t(notification.titleKey)}</span>
                    <span className={styles.itemDesc}>{t(notification.descKey)}</span>
                    <span className={styles.itemTime}>
                      {notification.time} {t('supplier.notifications.ago')}
                    </span>
                  </div>
                  {!notification.read && <div className={styles.unreadDot} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
