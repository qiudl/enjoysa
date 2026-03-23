import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, ShoppingCart, Settings, DollarSign, Check, Star, Trash2, Loader2 } from 'lucide-react';
import { supplierNotificationService, type ApiNotification } from '../../../services/supplierNotificationService';
import styles from './SupplierNotificationsPage.module.css';

export interface SupplierNotificationsPageProps {
  onNavigate?: (path: string) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  new_order: <ShoppingCart size={16} />,
  order_cancelled: <ShoppingCart size={16} />,
  product_approved: <Check size={16} />,
  product_rejected: <Settings size={16} />,
  new_review: <Star size={16} />,
  settlement: <DollarSign size={16} />,
  system: <Settings size={16} />,
};

const typeColors: Record<string, string> = {
  new_order: '#3b82f6',
  order_cancelled: '#ef4444',
  product_approved: '#10b981',
  product_rejected: '#f59e0b',
  new_review: '#8b5cf6',
  settlement: '#10b981',
  system: '#6b7280',
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export const SupplierNotificationsPage: React.FC<SupplierNotificationsPageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [tab, setTab] = useState<'all' | 'unread' | 'read'>('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (tab === 'unread') params.is_read = 'false';
      if (tab === 'read') params.is_read = 'true';

      const data = await supplierNotificationService.list(params);
      setNotifications(data.items || []);
      setTotalPages(data.total_pages);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const handleMarkRead = async (id: number) => {
    try {
      await supplierNotificationService.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch {
      // silently fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await supplierNotificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // silently fail
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await supplierNotificationService.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // silently fail
    }
  };

  const handleClick = (notif: ApiNotification) => {
    if (!notif.is_read) {
      handleMarkRead(notif.id);
    }
    // Navigate to related entity
    if (notif.related_type && notif.related_id && onNavigate) {
      switch (notif.related_type) {
        case 'order':
          onNavigate(`/supplier/orders/${notif.related_id}`);
          break;
        case 'product':
          onNavigate(`/supplier/products/${notif.related_id}/edit`);
          break;
        case 'review':
          onNavigate('/supplier/reviews');
          break;
        case 'settlement':
          onNavigate('/supplier/settlement');
          break;
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const tabs = [
    { key: 'all' as const, label: t('supplier.notifications.all', 'All') },
    { key: 'unread' as const, label: t('supplier.notifications.unreadTab', 'Unread') },
    { key: 'read' as const, label: t('supplier.notifications.readTab', 'Read') },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('supplier.notifications.title')}</h1>
        {unreadCount > 0 && (
          <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
            <Check size={14} />
            {t('supplier.notifications.markAllRead')}
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        {tabs.map((t_) => (
          <button
            key={t_.key}
            className={`${styles.tabBtn} ${tab === t_.key ? styles.active : ''}`}
            onClick={() => setTab(t_.key)}
          >
            {t_.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.emptyState}>
          <Loader2 size={32} className={styles.spinner} />
        </div>
      ) : notifications.length > 0 ? (
        <>
          <div className={styles.notifList}>
            {notifications.map((notif) => {
              const color = typeColors[notif.type] || '#6b7280';
              const icon = typeIcons[notif.type] || <Bell size={16} />;
              return (
                <div
                  key={notif.id}
                  className={`${styles.notifCard} ${!notif.is_read ? styles.unread : ''}`}
                  onClick={() => handleClick(notif)}
                >
                  <div
                    className={styles.notifIcon}
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    {icon}
                  </div>
                  <div className={styles.notifContent}>
                    <span className={styles.notifTitle}>{notif.title}</span>
                    <span className={styles.notifDesc}>{notif.content}</span>
                    <span className={styles.notifTime}>{formatTime(notif.created_at)}</span>
                  </div>
                  <div className={styles.notifActions}>
                    {!notif.is_read && <div className={styles.unreadDot} />}
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notif.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                {t('common.prev', 'Prev')}
              </button>
              <span style={{ padding: '6px 12px', color: '#6b7280' }}>{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
              >
                {t('common.next', 'Next')}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <Bell size={32} className={styles.emptyIcon} />
          <p className={styles.emptyText}>{t('supplier.notifications.empty')}</p>
        </div>
      )}
    </div>
  );
};

export default SupplierNotificationsPage;
