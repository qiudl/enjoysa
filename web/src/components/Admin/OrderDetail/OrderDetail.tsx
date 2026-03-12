import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  User,
  Phone,
  Mail,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  Package,
  Building2,
} from 'lucide-react';
import clsx from 'clsx';
import type { Order, OrderStatus } from '../OrderTable';
import styles from './OrderDetail.module.css';

export interface OrderDetailProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onConfirm?: (order: Order) => void;
  onCancel?: (order: Order, reason: string) => void;
  onApproveRefund?: (order: Order) => void;
  onRejectRefund?: (order: Order, reason: string) => void;
}

export const OrderDetail: React.FC<OrderDetailProps> = ({
  order,
  open,
  onClose,
  onConfirm,
  onCancel,
  onApproveRefund,
  onRejectRefund,
}) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'info' | 'customer' | 'timeline'>('info');
  const [cancelReason, setCancelReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  if (!open || !order) return null;

  const getStatusLabel = (status: OrderStatus) => {
    const labels: Record<OrderStatus, string> = {
      pending: t('admin.orders.status.pending'),
      confirmed: t('admin.orders.status.confirmed'),
      completed: t('admin.orders.status.completed'),
      cancelled: t('admin.orders.status.cancelled'),
      refunding: t('admin.orders.status.refunding'),
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

  const formatTravelDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleCancel = () => {
    if (cancelReason.trim() && onCancel) {
      onCancel(order, cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
    }
  };

  const handleRejectRefund = () => {
    if (rejectReason.trim() && onRejectRefund) {
      onRejectRefund(order, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
    }
  };

  const tabs = [
    { key: 'info', label: t('admin.orders.detail.tabs.info') },
    { key: 'customer', label: t('admin.orders.detail.tabs.customer') },
    { key: 'timeline', label: t('admin.orders.detail.tabs.timeline') },
  ];

  const timelineEvents = [
    { time: order.createdAt, label: t('admin.orders.detail.timeline.created'), active: true },
    { time: order.paidAt, label: t('admin.orders.detail.timeline.paid'), active: !!order.paidAt },
    { time: order.confirmedAt, label: t('admin.orders.detail.timeline.confirmed'), active: !!order.confirmedAt },
    { time: order.completedAt, label: t('admin.orders.detail.timeline.completed'), active: !!order.completedAt },
  ].filter(e => e.time);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('admin.orders.detail.title')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.orderHeader}>
          <div className={styles.orderInfo}>
            <div className={styles.orderMeta}>
              <span className={styles.orderNo}>{order.orderNo}</span>
              <span className={clsx(styles.statusBadge, styles[order.status])}>
                {getStatusLabel(order.status)}
              </span>
            </div>
            <div className={styles.amountBox}>
              <span className={styles.amountLabel}>{t('admin.orders.detail.orderAmount')}</span>
              <span className={styles.amount}>{formatPrice(order.amount)}</span>
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
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                  <Package size={16} />
                  {t('admin.orders.detail.productInfo')}
                </h4>
                <div className={styles.productCard}>
                  <h5 className={styles.productName}>{order.productName}</h5>
                  <div className={styles.productMeta}>
                    <span>
                      <Calendar size={14} />
                      {formatTravelDate(order.travelDate)}
                    </span>
                    <span>
                      <Users size={14} />
                      {order.quantity} {t('admin.orders.detail.guests')}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                  <Building2 size={16} />
                  {t('admin.orders.detail.supplierInfo')}
                </h4>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>{t('admin.orders.detail.supplierName')}</span>
                  <span className={styles.infoValue}>{order.supplierName}</span>
                </div>
              </div>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                  <Clock size={16} />
                  {t('admin.orders.detail.orderTime')}
                </h4>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>{t('admin.orders.detail.createdAt')}</span>
                  <span className={styles.infoValue}>{formatDate(order.createdAt)}</span>
                </div>
                {order.paidAt && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>{t('admin.orders.detail.paidAt')}</span>
                    <span className={styles.infoValue}>{formatDate(order.paidAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'customer' && (
            <div className={styles.customerSection}>
              <div className={styles.customerCard}>
                <div className={styles.customerItem}>
                  <User size={18} />
                  <div>
                    <span className={styles.customerLabel}>{t('admin.orders.detail.customerName')}</span>
                    <span className={styles.customerValue}>{order.customerName}</span>
                  </div>
                </div>
                <div className={styles.customerItem}>
                  <Phone size={18} />
                  <div>
                    <span className={styles.customerLabel}>{t('admin.orders.detail.customerPhone')}</span>
                    <span className={styles.customerValue}>{order.customerPhone}</span>
                  </div>
                </div>
                <div className={styles.customerItem}>
                  <Mail size={18} />
                  <div>
                    <span className={styles.customerLabel}>{t('admin.orders.detail.customerEmail')}</span>
                    <span className={styles.customerValue}>{order.customerEmail}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className={styles.timelineSection}>
              {timelineEvents.map((event, index) => (
                <div key={index} className={clsx(styles.timelineItem, event.active && styles.active)}>
                  <div className={styles.timelineDot} />
                  <div className={styles.timelineContent}>
                    <span className={styles.timelineLabel}>{event.label}</span>
                    <span className={styles.timelineTime}>{formatDate(event.time!)}</span>
                  </div>
                </div>
              ))}
              {order.status === 'cancelled' && order.cancelledAt && (
                <div className={clsx(styles.timelineItem, styles.cancelled)}>
                  <div className={styles.timelineDot} />
                  <div className={styles.timelineContent}>
                    <span className={styles.timelineLabel}>{t('admin.orders.detail.timeline.cancelled')}</span>
                    <span className={styles.timelineTime}>{formatDate(order.cancelledAt)}</span>
                    {order.cancelReason && (
                      <span className={styles.cancelReason}>{order.cancelReason}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {order.status === 'pending' && (
            <>
              <button
                className={clsx(styles.btn, styles.btnCancel)}
                onClick={() => setShowCancelModal(true)}
              >
                <XCircle size={16} />
                <span>{t('admin.orders.actions.cancel')}</span>
              </button>
              <button
                className={clsx(styles.btn, styles.btnConfirm)}
                onClick={() => onConfirm?.(order)}
              >
                <CheckCircle size={16} />
                <span>{t('admin.orders.actions.confirm')}</span>
              </button>
            </>
          )}
          {order.status === 'refunding' && (
            <>
              <button
                className={clsx(styles.btn, styles.btnReject)}
                onClick={() => setShowRejectModal(true)}
              >
                <XCircle size={16} />
                <span>{t('admin.orders.actions.rejectRefund')}</span>
              </button>
              <button
                className={clsx(styles.btn, styles.btnApprove)}
                onClick={() => onApproveRefund?.(order)}
              >
                <RotateCcw size={16} />
                <span>{t('admin.orders.actions.approveRefund')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <>
          <div className={styles.modalOverlay} onClick={() => setShowCancelModal(false)} />
          <div className={styles.modal}>
            <h3>{t('admin.orders.cancel.title')}</h3>
            <p>{t('admin.orders.cancel.message')}</p>
            <textarea
              className={styles.textarea}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('admin.orders.cancel.placeholder')}
              rows={4}
            />
            <div className={styles.modalActions}>
              <button
                className={clsx(styles.btn, styles.btnSecondary)}
                onClick={() => setShowCancelModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className={clsx(styles.btn, styles.btnCancel)}
                onClick={handleCancel}
                disabled={!cancelReason.trim()}
              >
                {t('admin.orders.actions.confirmCancel')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Reject Refund Modal */}
      {showRejectModal && (
        <>
          <div className={styles.modalOverlay} onClick={() => setShowRejectModal(false)} />
          <div className={styles.modal}>
            <h3>{t('admin.orders.rejectRefund.title')}</h3>
            <p>{t('admin.orders.rejectRefund.message')}</p>
            <textarea
              className={styles.textarea}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('admin.orders.rejectRefund.placeholder')}
              rows={4}
            />
            <div className={styles.modalActions}>
              <button
                className={clsx(styles.btn, styles.btnSecondary)}
                onClick={() => setShowRejectModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className={clsx(styles.btn, styles.btnReject)}
                onClick={handleRejectRefund}
                disabled={!rejectReason.trim()}
              >
                {t('admin.orders.actions.rejectRefund')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default OrderDetail;
