import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, ShoppingCart, Settings, DollarSign, Check, Star } from 'lucide-react';
import { supplierNotificationService, type ApiNotification } from '../../../services/supplierNotificationService';
import styles from './NotificationPanel.module.css';

const typeIcons: Record<string, React.ReactNode> = {
  new_order: <ShoppingCart size={16} />,
  order_cancelled: <ShoppingCart size={16} />,
  product_approved: <Check size={16} />,
  product_rejected: <Settings size={16} />,
  new_review: <Star size={16} />,
  settlement: <DollarSign size={16} />,
  system: <Settings size={16} />,
  order: <ShoppingCart size={16} />,
};

const typeColors: Record<string, string> = {
  new_order: '#3b82f6',
  order_cancelled: '#ef4444',
  product_approved: '#10b981',
  product_rejected: '#f59e0b',
  new_review: '#8b5cf6',
  settlement: '#10b981',
  system: '#6b7280',
  order: '#3b82f6',
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

interface NotificationPanelProps {
  onViewAll?: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onViewAll }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await supplierNotificationService.getUnreadCount();
      setUnreadCount(data.count);
    } catch {
      // silently fail
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await supplierNotificationService.list({ page: 1, page_size: 5 });
      setNotifications(data.items || []);
    } catch {
      // silently fail
    }
  }, []);

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

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

  const handleMarkAllRead = async () => {
    try {
      await supplierNotificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  };

  const handleNotificationClick = async (id: number) => {
    try {
      await supplierNotificationService.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
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
          <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
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
              notifications.map((notification) => {
                const color = typeColors[notification.type] || '#6b7280';
                const icon = typeIcons[notification.type] || <Bell size={16} />;
                return (
                  <div
                    key={notification.id}
                    className={`${styles.item} ${!notification.is_read ? styles.unread : ''}`}
                    onClick={() => handleNotificationClick(notification.id)}
                  >
                    <div
                      className={styles.itemIcon}
                      style={{
                        backgroundColor: `${color}15`,
                        color: color,
                      }}
                    >
                      {icon}
                    </div>
                    <div className={styles.itemContent}>
                      <span className={styles.itemTitle}>{notification.title}</span>
                      <span className={styles.itemDesc}>{notification.content}</span>
                      <span className={styles.itemTime}>
                        {formatTime(notification.created_at)} {t('supplier.notifications.ago')}
                      </span>
                    </div>
                    {!notification.is_read && <div className={styles.unreadDot} />}
                  </div>
                );
              })
            )}
          </div>

          {onViewAll && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
              <button
                onClick={() => { setOpen(false); onViewAll(); }}
                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 13 }}
              >
                {t('supplier.notifications.viewAll', 'View All')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
