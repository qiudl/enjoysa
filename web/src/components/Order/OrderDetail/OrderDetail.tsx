import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Users, Phone, Mail, User, CreditCard, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import styles from './OrderDetail.module.css';
import type { Order, OrderStatus } from '../../../types';

export interface OrderDetailProps {
  /** 订单数据 */
  order: Order;
  /** 支付按钮点击 */
  onPay?: () => void;
  /** 取消订单按钮点击 */
  onCancel?: () => void;
  /** 申请退款按钮点击 */
  onRefund?: () => void;
  /** 查看凭证按钮点击 */
  onViewVoucher?: () => void;
  /** 联系客服按钮点击 */
  onContactSupport?: () => void;
  /** 再次预订按钮点击 */
  onReorder?: () => void;
  /** 写评价按钮点击 */
  onWriteReview?: () => void;
  /** 语言 */
  language?: 'zh' | 'en';
}

const statusConfig: Record<OrderStatus, { color: string; bgColor: string; icon: React.ReactNode }> = {
  pending_payment: { color: 'var(--color-warning)', bgColor: 'var(--color-warning-bg)', icon: <Clock size={20} /> },
  paid: { color: 'var(--color-primary)', bgColor: 'var(--color-primary-50)', icon: <CheckCircle size={20} /> },
  confirmed: { color: 'var(--color-success)', bgColor: 'var(--color-success-bg)', icon: <CheckCircle size={20} /> },
  in_progress: { color: 'var(--color-primary)', bgColor: 'var(--color-primary-50)', icon: <Clock size={20} /> },
  completed: { color: 'var(--color-text-muted)', bgColor: 'var(--color-background-alt)', icon: <CheckCircle size={20} /> },
  cancelled: { color: 'var(--color-text-muted)', bgColor: 'var(--color-background-alt)', icon: <XCircle size={20} /> },
  refund_requested: { color: 'var(--color-warning)', bgColor: 'var(--color-warning-bg)', icon: <AlertCircle size={20} /> },
  refunded: { color: 'var(--color-text-muted)', bgColor: 'var(--color-background-alt)', icon: <CheckCircle size={20} /> },
};

// Payment method labels will be fetched from translations

export const OrderDetail: React.FC<OrderDetailProps> = ({
  order,
  onPay,
  onCancel,
  onRefund,
  onViewVoucher,
  onContactSupport,
  onReorder,
  onWriteReview,
  language,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const statusStyle = statusConfig[order.status];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStatusTimeline = () => {
    const events: { time: string; label: string; status: 'done' | 'current' | 'pending' }[] = [];

    // Order created
    events.push({
      time: formatDate(order.createdAt),
      label: t('order.timeline.orderCreated'),
      status: 'done',
    });

    // Payment
    if (order.paidAt) {
      events.push({
        time: formatDate(order.paidAt),
        label: t('order.timeline.paymentSuccess'),
        status: 'done',
      });
    } else if (order.status === 'pending_payment') {
      events.push({
        time: '-',
        label: t('order.timeline.waitingPayment'),
        status: 'current',
      });
    }

    // Confirmed
    if (order.status === 'confirmed' || order.status === 'in_progress' || order.status === 'completed') {
      events.push({
        time: formatDate(order.updatedAt),
        label: t('order.timeline.orderConfirmed'),
        status: 'done',
      });
    }

    // Completed
    if (order.completedAt) {
      events.push({
        time: formatDate(order.completedAt),
        label: t('order.timeline.tripCompleted'),
        status: 'done',
      });
    }

    // Cancelled
    if (order.cancelledAt) {
      events.push({
        time: formatDate(order.cancelledAt),
        label: t('order.timeline.orderCancelled'),
        status: 'done',
      });
    }

    return (
      <div className={styles.timeline}>
        {events.map((event, index) => (
          <div
            key={index}
            className={clsx(styles.timelineItem, styles[event.status])}
          >
            <div className={styles.timelineDot} />
            <div className={styles.timelineContent}>
              <span className={styles.timelineLabel}>{event.label}</span>
              <span className={styles.timelineTime}>{event.time}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderActions = () => {
    const actions: React.ReactNode[] = [];

    switch (order.status) {
      case 'pending_payment':
        actions.push(
          <button key="pay" className={clsx(styles.actionButton, styles.primary)} onClick={onPay}>
            {t('order.payNow')}
          </button>,
          <button key="cancel" className={clsx(styles.actionButton, styles.outline)} onClick={onCancel}>
            {t('order.cancelOrder')}
          </button>
        );
        break;
      case 'paid':
      case 'confirmed':
      case 'in_progress':
        actions.push(
          <button key="voucher" className={clsx(styles.actionButton, styles.primary)} onClick={onViewVoucher}>
            {t('order.viewVoucher')}
          </button>,
          <button key="refund" className={clsx(styles.actionButton, styles.outline)} onClick={onRefund}>
            {t('order.requestRefund')}
          </button>
        );
        break;
      case 'completed':
        actions.push(
          <button key="review" className={clsx(styles.actionButton, styles.primary)} onClick={onWriteReview}>
            {t('order.writeReview')}
          </button>,
          <button key="reorder" className={clsx(styles.actionButton, styles.outline)} onClick={onReorder}>
            {t('order.reorder')}
          </button>
        );
        break;
      case 'cancelled':
      case 'refunded':
        actions.push(
          <button key="reorder" className={clsx(styles.actionButton, styles.primary)} onClick={onReorder}>
            {t('order.reorder')}
          </button>
        );
        break;
    }

    actions.push(
      <button key="support" className={clsx(styles.actionButton, styles.text)} onClick={onContactSupport}>
        {t('order.contactSupport')}
      </button>
    );

    return actions;
  };

  return (
    <div className={styles.container}>
      {/* Status Header */}
      <div
        className={styles.statusHeader}
        style={{ backgroundColor: statusStyle.bgColor }}
      >
        <div className={styles.statusIcon} style={{ color: statusStyle.color }}>
          {statusStyle.icon}
        </div>
        <div className={styles.statusInfo}>
          <span className={styles.statusLabel} style={{ color: statusStyle.color }}>
            {t(`order.status.${order.status}`)}
          </span>
          <span className={styles.orderNumber}>
            {t('order.orderNumber')}: {order.orderNumber}
          </span>
        </div>
      </div>

      {/* Product Items */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('order.bookingDetails')}</h3>
        <div className={styles.items}>
          {order.items.map((item) => (
            <div key={item.id} className={styles.item}>
              <img
                src={item.productImage}
                alt={isZh ? item.productTitle : (item.productTitleEn || item.productTitle)}
                className={styles.itemImage}
              />
              <div className={styles.itemInfo}>
                <h4 className={styles.itemTitle}>
                  {isZh ? item.productTitle : (item.productTitleEn || item.productTitle)}
                </h4>
                <div className={styles.itemMeta}>
                  <span>
                    <Calendar size={14} />
                    {item.travelDate}
                  </span>
                  <span>
                    <Users size={14} />
                    {item.quantity} {t('participant.people')}
                  </span>
                </div>
                <div className={styles.itemPrice}>
                  <span className={styles.unitPrice}>¥{item.unitPrice} × {item.quantity}</span>
                  <span className={styles.totalPrice}>¥{item.totalPrice}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Info */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('order.contactInfo')}</h3>
        <div className={styles.contactInfo}>
          <div className={styles.contactItem}>
            <User size={16} />
            <span>{order.contactInfo.name}</span>
          </div>
          <div className={styles.contactItem}>
            <Phone size={16} />
            <span>{order.contactInfo.phone}</span>
          </div>
          <div className={styles.contactItem}>
            <Mail size={16} />
            <span>{order.contactInfo.email}</span>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      {order.paymentMethod && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('order.paymentMethod')}</h3>
          <div className={styles.paymentInfo}>
            <CreditCard size={16} />
            <span>{t(`order.paymentMethods.${order.paymentMethod}`) || order.paymentMethod}</span>
          </div>
        </div>
      )}

      {/* Price Summary */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('order.orderSummary')}</h3>
        <div className={styles.priceSummary}>
          <div className={styles.priceRow}>
            <span>{t('order.subtotal')}</span>
            <span>¥{order.totalAmount.toFixed(2)}</span>
          </div>
          {/* Add discount row if applicable */}
          <div className={clsx(styles.priceRow, styles.total)}>
            <span>{t('order.total')}</span>
            <span className={styles.totalAmount}>
              <span className={styles.currency}>¥</span>
              {order.totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('order.timeline.title')}</h3>
        {renderStatusTimeline()}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {renderActions()}
      </div>
    </div>
  );
};

export default OrderDetail;
