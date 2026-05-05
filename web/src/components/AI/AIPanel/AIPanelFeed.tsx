import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AIRole } from './AIPanel';
import { supplierNotificationService, type ApiNotification } from '../../../services/supplierNotificationService';
import styles from './AIPanel.module.css';
import clsx from 'clsx';

interface FeedProps {
  role: AIRole;
  onViewAll?: () => void;
}

const FEED_ICON_MAP: Record<string, { className: string; emoji: string }> = {
  new_order: { className: 'feedIconOrder', emoji: '📦' },
  order: { className: 'feedIconOrder', emoji: '📦' },
  order_cancelled: { className: 'feedIconOrder', emoji: '📦' },
  product_approved: { className: 'feedIconProduct', emoji: '📋' },
  product_rejected: { className: 'feedIconProduct', emoji: '📋' },
  new_review: { className: 'feedIconReview', emoji: '⭐' },
  settlement: { className: 'feedIconSettlement', emoji: '💰' },
  system: { className: 'feedIconSystem', emoji: '📢' },
};

function getIconInfo(type: string) {
  return FEED_ICON_MAP[type] || FEED_ICON_MAP.system;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export const AIPanelFeed: React.FC<FeedProps> = ({ role, onViewAll }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (role !== 'supplier') {
      // Admin notifications not yet implemented - show empty
      setLoading(false);
      return;
    }
    try {
      const resp = await supplierNotificationService.list({ page: 1, page_size: 20 });
      setNotifications(resp.items || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleClick = (notif: ApiNotification) => {
    // Mark as read
    if (!notif.is_read && role === 'supplier') {
      supplierNotificationService.markRead(notif.id).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    // Navigate based on related type
    if (notif.related_type === 'order' && notif.related_id) {
      navigate(`/${role}/orders/${notif.related_id}`);
    } else if (notif.related_type === 'product') {
      navigate(`/${role}/products`);
    } else if (notif.related_type === 'review') {
      navigate(`/${role}/reviews`);
    } else if (notif.related_type === 'settlement') {
      navigate(`/${role}/settlement`);
    }
  };

  if (loading) {
    return <div className={styles.feedEmpty}>{t('common.loading', '加载中...')}</div>;
  }

  if (notifications.length === 0) {
    return <div className={styles.feedEmpty}>{t('aiPanel.noNotifications', '暂无动态')}</div>;
  }

  return (
    <>
      <div className={styles.feedList}>
        {notifications.map(notif => {
          const icon = getIconInfo(notif.type);
          return (
            <div
              key={notif.id}
              className={clsx(styles.feedItem, !notif.is_read && styles.unread)}
              onClick={() => handleClick(notif)}
            >
              <div className={clsx(styles.feedIcon, styles[icon.className])}>{icon.emoji}</div>
              <div className={styles.feedBody}>
                <div className={styles.feedTitle}>{notif.title}</div>
                <div className={styles.feedDesc}>{notif.content}</div>
              </div>
              <div className={styles.feedTime}>{formatRelativeTime(notif.created_at)}</div>
            </div>
          );
        })}
      </div>
      {onViewAll && (
        <button className={styles.feedViewAll} onClick={onViewAll}>
          {t('aiPanel.viewAllNotifications', '查看全部通知 →')}
        </button>
      )}
    </>
  );
};
