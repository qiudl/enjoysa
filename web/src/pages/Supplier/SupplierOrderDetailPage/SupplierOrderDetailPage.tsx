import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, Clock, ShieldCheck, QrCode } from 'lucide-react';
import styles from './SupplierOrderDetailPage.module.css';

/* ------------------------------------------------------------------ */
/*  Data models                                                       */
/* ------------------------------------------------------------------ */

interface OrderTimeline {
  id: string;
  event: string; // i18n key like 'supplier.orderDetail.eventCreated'
  time: string;
  detail?: string;
}

interface Traveler {
  name: string;
  phone?: string;
  type: 'adult' | 'child';
}

interface OrderDetail {
  id: string;
  orderNo: string;
  status: 'pending' | 'confirmed' | 'verified' | 'completed' | 'cancelled';
  product: string;
  productEn: string;
  productImage: string;
  travelDate: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  customer: string;
  customerPhone: string;
  customerEmail: string;
  travelers: Traveler[];
  paymentMethod: string;
  paidAt: string;
  verificationCode: string;
  verifiedAt?: string;
  channel: string;
  createdAt: string;
  timeline: OrderTimeline[];
  remark?: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                         */
/* ------------------------------------------------------------------ */

const MOCK_ORDER: OrderDetail = {
  id: 'ord-001',
  orderNo: 'ORD-20260320-001',
  status: 'confirmed',
  product: '袋鼠岛一日游',
  productEn: 'Kangaroo Island Day Tour',
  productImage: '',
  travelDate: '2026-03-25',
  quantity: 2,
  unitPrice: 398,
  totalAmount: 796,
  currency: 'AUD',
  customer: 'Alice Wang',
  customerPhone: '+61 412 345 678',
  customerEmail: 'alice.wang@example.com',
  travelers: [
    { name: 'Alice Wang', phone: '+61 412 345 678', type: 'adult' },
    { name: 'Tom Wang', type: 'child' },
  ],
  paymentMethod: 'Credit Card',
  paidAt: '2026-03-20 10:35',
  verificationCode: 'VRF-8A3F2D',
  channel: 'direct',
  createdAt: '2026-03-20 10:30',
  timeline: [
    {
      id: 'tl-1',
      event: 'supplier.orderDetail.eventCreated',
      time: '2026-03-20 10:30',
      detail: 'Order placed by customer',
    },
    {
      id: 'tl-2',
      event: 'supplier.orderDetail.eventPaid',
      time: '2026-03-20 10:35',
      detail: 'Payment received via Credit Card',
    },
    {
      id: 'tl-3',
      event: 'supplier.orderDetail.eventConfirmed',
      time: '2026-03-20 11:00',
      detail: 'Supplier confirmed the order',
    },
  ],
  remark: 'Customer requests window seat on the bus.',
};

/* ------------------------------------------------------------------ */
/*  Timeline step definitions                                         */
/* ------------------------------------------------------------------ */

const TIMELINE_STEPS = [
  'supplier.orderDetail.eventCreated',
  'supplier.orderDetail.eventPaid',
  'supplier.orderDetail.eventConfirmed',
  'supplier.orderDetail.eventVerified',
  'supplier.orderDetail.eventCompleted',
] as const;

const STATUS_ORDER: OrderDetail['status'][] = [
  'pending',
  'confirmed',
  'verified',
  'completed',
];

function getStepIndex(status: OrderDetail['status']): number {
  const idx = STATUS_ORDER.indexOf(status);
  if (status === 'cancelled') return -1;
  // pending = 0 means only Created is past (index 0)
  // confirmed = 1 means Created+Paid+Confirmed are past (index 2)
  // Map: pending→0, confirmed→2, verified→3, completed→4
  const map: Record<number, number> = { 0: 0, 1: 2, 2: 3, 3: 4 };
  return map[idx] ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface SupplierOrderDetailPageProps {
  orderId?: string;
  onNavigate?: (path: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export const SupplierOrderDetailPage: React.FC<SupplierOrderDetailPageProps> = ({
  onNavigate,
}) => {
  const { t, i18n } = useTranslation();
  const [order, setOrder] = useState<OrderDetail>(MOCK_ORDER);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const currentStepIdx = getStepIndex(order.status);

  /* ------ helpers ------ */

  const statusLabelKey = `supplier.orderDetail.status${
    order.status.charAt(0).toUpperCase() + order.status.slice(1)
  }`;

  const statusClass = (() => {
    const map: Record<OrderDetail['status'], string> = {
      pending: styles.statusPending,
      confirmed: styles.statusConfirmed,
      verified: styles.statusVerified,
      completed: styles.statusCompleted,
      cancelled: styles.statusCancelled,
    };
    return map[order.status] ?? '';
  })();

  const productName =
    i18n.language === 'en' ? order.productEn : order.product;

  /* ------ verify action ------ */

  const handleVerify = () => {
    setShowConfirmModal(true);
  };

  const confirmVerify = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    setOrder((prev) => ({
      ...prev,
      status: 'verified',
      verifiedAt: ts,
      timeline: [
        ...prev.timeline,
        {
          id: `tl-${prev.timeline.length + 1}`,
          event: 'supplier.orderDetail.eventVerified',
          time: ts,
          detail: 'Verification completed by supplier',
        },
      ],
    }));
    setShowConfirmModal(false);
  };

  /* ------ timeline item state helper ------ */

  const getItemState = (stepIdx: number) => {
    if (order.status === 'cancelled') return 'future';
    if (stepIdx < currentStepIdx) return 'past';
    if (stepIdx === currentStepIdx) return 'current';
    return 'future';
  };

  const getTimeForStep = (eventKey: string): string => {
    const entry = order.timeline.find((tl) => tl.event === eventKey);
    return entry?.time ?? '';
  };

  const getDetailForStep = (eventKey: string): string | undefined => {
    const entry = order.timeline.find((tl) => tl.event === eventKey);
    return entry?.detail;
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => onNavigate?.('/supplier/orders')}
          aria-label={t('supplier.orderDetail.backToList')}
        >
          <ArrowLeft size={18} />
        </button>

        <div className={styles.headerInfo}>
          <h1 className={styles.orderNo}>{order.orderNo}</h1>
        </div>

        <div className={styles.headerActions}>
          {order.status === 'confirmed' && (
            <button className={styles.headerVerifyBtn} onClick={handleVerify}>
              <ShieldCheck size={16} />
              {t('supplier.orderDetail.verify')}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Left: Timeline */}
        <div className={styles.timelineSection}>
          <div className={styles.timelineCard}>
            <h2 className={styles.timelineTitle}>
              <Clock size={16} />
              {t('supplier.orderDetail.timeline')}
            </h2>

            <div className={styles.timeline}>
              {TIMELINE_STEPS.map((eventKey, idx) => {
                const state = getItemState(idx);
                const time = getTimeForStep(eventKey);
                const detail = getDetailForStep(eventKey);

                const itemClass =
                  state === 'past'
                    ? styles.timelineItemPast
                    : state === 'current'
                    ? styles.timelineItemCurrent
                    : '';

                const dotClass =
                  state === 'past'
                    ? styles.timelineDotPast
                    : state === 'current'
                    ? styles.timelineDotCurrent
                    : styles.timelineDotFuture;

                return (
                  <div
                    key={eventKey}
                    className={`${styles.timelineItem} ${itemClass}`}
                  >
                    {state === 'past' ? (
                      <span className={styles.timelineCheckmark}>
                        <CheckCircle size={14} />
                      </span>
                    ) : (
                      <span className={`${styles.timelineDot} ${dotClass}`} />
                    )}

                    <div
                      className={
                        state === 'future'
                          ? styles.timelineEventFuture
                          : styles.timelineEvent
                      }
                    >
                      {t(eventKey)}
                    </div>

                    {time && (
                      <div className={styles.timelineTime}>{time}</div>
                    )}

                    {detail && (
                      <div className={styles.timelineDetail}>{detail}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Remark */}
          <div className={styles.remarkSection}>
            <h3 className={styles.remarkTitle}>
              {t('supplier.orderDetail.remark')}
            </h3>
            {order.remark ? (
              <p className={styles.remarkText}>{order.remark}</p>
            ) : (
              <p className={styles.remarkEmpty}>--</p>
            )}
          </div>
        </div>

        {/* Right: Info cards */}
        <div className={styles.infoSection}>
          {/* Order Info */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <h3 className={styles.infoCardTitle}>
                {t('supplier.orderDetail.orderInfo')}
              </h3>
              <span className={`${styles.statusBadge} ${statusClass}`}>
                {t(statusLabelKey)}
              </span>
            </div>
            <div className={styles.infoCardBody}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  {t('supplier.orderDetail.product')}
                </span>
                <span className={styles.infoValue}>{productName}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  {t('supplier.orderDetail.travelDate')}
                </span>
                <span className={styles.infoValue}>{order.travelDate}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  {t('supplier.orderDetail.quantity')}
                </span>
                <span className={styles.infoValue}>{order.quantity}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  {t('supplier.orderDetail.unitPrice')}
                </span>
                <span className={styles.infoValue}>
                  {order.currency} {order.unitPrice.toFixed(2)}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  {t('supplier.orderDetail.totalAmount')}
                </span>
                <span className={`${styles.infoValue} ${styles.infoValueAmount}`}>
                  {order.currency} {order.totalAmount.toFixed(2)}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  {t('supplier.orderDetail.paymentMethod')}
                </span>
                <span className={styles.infoValue}>{order.paymentMethod}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  {t('supplier.orderDetail.paidAt')}
                </span>
                <span className={styles.infoValue}>{order.paidAt}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  {t('supplier.orderDetail.channel')}
                </span>
                <span className={styles.channelValue}>{order.channel}</span>
              </div>
            </div>
          </div>

          {/* Travelers */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <h3 className={styles.infoCardTitle}>
                {t('supplier.orderDetail.travelers')}
              </h3>
            </div>
            <div className={styles.infoCardBody}>
              <div className={styles.travelerList}>
                {order.travelers.map((traveler, idx) => (
                  <div key={idx} className={styles.travelerItem}>
                    <div className={styles.travelerInfo}>
                      <span className={styles.travelerName}>
                        {traveler.name}
                      </span>
                      {traveler.phone && (
                        <span className={styles.travelerPhone}>
                          {traveler.phone}
                        </span>
                      )}
                    </div>
                    <span
                      className={`${styles.travelerTypeBadge} ${
                        traveler.type === 'adult'
                          ? styles.travelerAdult
                          : styles.travelerChild
                      }`}
                    >
                      {t(
                        traveler.type === 'adult'
                          ? 'supplier.orderDetail.travelerAdult'
                          : 'supplier.orderDetail.travelerChild'
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Verification */}
          <div className={styles.verifyCard}>
            <h3 className={styles.verifyCardTitle}>
              <ShieldCheck size={16} />
              {t('supplier.orderDetail.verification')}
            </h3>

            <div className={styles.verifyCodeArea}>
              <div className={styles.verifyCodePlaceholder}>
                <QrCode size={48} />
              </div>
              <div className={styles.verifyCode}>
                {order.verificationCode}
              </div>
            </div>

            <div
              className={`${styles.verifyStatus} ${
                order.verifiedAt
                  ? styles.verifyStatusVerified
                  : styles.verifyStatusNotVerified
              }`}
            >
              {order.verifiedAt ? (
                <>
                  <CheckCircle size={14} />
                  {t('supplier.orderDetail.verified')} ({order.verifiedAt})
                </>
              ) : (
                <>
                  <Clock size={14} />
                  {t('supplier.orderDetail.notVerified')}
                </>
              )}
            </div>

            {order.status === 'confirmed' && (
              <button className={styles.verifyBtn} onClick={handleVerify}>
                <ShieldCheck size={18} />
                {t('supplier.orderDetail.verify')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className={styles.confirmModal}>
          <div
            className={styles.confirmOverlay}
            onClick={() => setShowConfirmModal(false)}
          />
          <div className={styles.confirmBox}>
            <h3 className={styles.confirmTitle}>
              {t('supplier.orderDetail.verifyConfirm')}
            </h3>
            <p className={styles.confirmDesc}>
              {t('supplier.orderDetail.verifyCode')}:
            </p>
            <div className={styles.confirmCode}>
              {order.verificationCode}
            </div>
            <div className={styles.confirmActions}>
              <button
                className={styles.confirmCancelBtn}
                onClick={() => setShowConfirmModal(false)}
              >
                {t('supplier.orderDetail.backToList')}
              </button>
              <button
                className={styles.confirmOkBtn}
                onClick={confirmVerify}
              >
                {t('supplier.orderDetail.verify')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierOrderDetailPage;
