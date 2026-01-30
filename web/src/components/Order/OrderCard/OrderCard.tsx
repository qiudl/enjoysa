import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Calendar, Users, ChevronRight } from 'lucide-react';
import styles from './OrderCard.module.css';
import type { Order, OrderStatus } from '../../../types';

export interface OrderCardProps {
  /** 订单数据 */
  order: Order;
  /** 点击回调 */
  onClick?: (order: Order) => void;
  /** 操作按钮点击 */
  onActionClick?: (order: Order, action: 'pay' | 'cancel' | 'refund' | 'review' | 'reorder') => void;
  /** 语言 */
  language?: 'zh' | 'en';
}

const statusConfig: Record<OrderStatus, { color: string; bgColor: string }> = {
  pending_payment: { color: 'var(--color-warning)', bgColor: 'var(--color-warning-bg)' },
  paid: { color: 'var(--color-primary)', bgColor: 'var(--color-primary-50)' },
  confirmed: { color: 'var(--color-success)', bgColor: 'var(--color-success-bg)' },
  in_progress: { color: 'var(--color-primary)', bgColor: 'var(--color-primary-50)' },
  completed: { color: 'var(--color-text-muted)', bgColor: 'var(--color-background-alt)' },
  cancelled: { color: 'var(--color-text-muted)', bgColor: 'var(--color-background-alt)' },
  refund_requested: { color: 'var(--color-warning)', bgColor: 'var(--color-warning-bg)' },
  refunded: { color: 'var(--color-text-muted)', bgColor: 'var(--color-background-alt)' },
};

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onClick,
  onActionClick,
  language,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const firstItem = order.items[0];
  const title = isZh ? firstItem.productTitle : (firstItem.productTitleEn || firstItem.productTitle);

  const statusStyle = statusConfig[order.status];

  const renderActionButton = () => {
    switch (order.status) {
      case 'pending_payment':
        return (
          <button
            className={clsx(styles.actionButton, styles.primary)}
            onClick={(e) => {
              e.stopPropagation();
              onActionClick?.(order, 'pay');
            }}
          >
            {t('order.payNow')}
          </button>
        );
      case 'completed':
        return (
          <button
            className={clsx(styles.actionButton, styles.outline)}
            onClick={(e) => {
              e.stopPropagation();
              onActionClick?.(order, 'review');
            }}
          >
            {t('order.writeReview')}
          </button>
        );
      case 'cancelled':
      case 'refunded':
        return (
          <button
            className={clsx(styles.actionButton, styles.outline)}
            onClick={(e) => {
              e.stopPropagation();
              onActionClick?.(order, 'reorder');
            }}
          >
            {t('order.reorder')}
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <article
      className={styles.card}
      onClick={() => onClick?.(order)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(order);
        }
      }}
    >
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.orderNumber}>
          {t('order.orderNumber')}: {order.orderNumber}
        </span>
        <span
          className={styles.status}
          style={{
            color: statusStyle.color,
            backgroundColor: statusStyle.bgColor,
          }}
        >
          {t(`order.status.${order.status}`)}
        </span>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.imageWrapper}>
          <img
            src={firstItem.productImage}
            alt={title}
            className={styles.image}
          />
          {order.items.length > 1 && (
            <span className={styles.itemCount}>+{order.items.length - 1}</span>
          )}
        </div>

        <div className={styles.info}>
          <h3 className={styles.title}>{title}</h3>

          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <Calendar size={14} />
              {order.items[0].travelDate}
            </span>
            <span className={styles.metaItem}>
              <Users size={14} />
              {order.items.reduce((sum, item) => sum + item.quantity, 0)} {t('participant.people')}
            </span>
          </div>

          <div className={styles.price}>
            <span className={styles.totalLabel}>{t('order.total')}:</span>
            <span className={styles.totalAmount}>
              <span className={styles.currency}>¥</span>
              {order.totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

        <ChevronRight size={20} className={styles.arrow} />
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.orderTime}>
          {t('order.orderTime')}: {new Date(order.createdAt).toLocaleString(isZh ? 'zh-CN' : 'en-US')}
        </span>
        {renderActionButton()}
      </div>
    </article>
  );
};

export default OrderCard;
