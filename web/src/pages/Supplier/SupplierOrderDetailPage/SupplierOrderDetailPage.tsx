import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, Clock, ShieldCheck, QrCode } from 'lucide-react';
import styles from './SupplierOrderDetailPage.module.css';
import {
  getSupplierOrder,
  verifySupplierOrder,
  type Order as BackendOrder,
} from '../../../services/orderService';
import { ApiError } from '../../../services/api';

/* ------------------------------------------------------------------ */
/*  Data models — view-model derived from backend Order               */
/* ------------------------------------------------------------------ */

// Display status drives the timeline progress bar and badge color.
// `paid_unverified` and `paid_verified` are derived states for the page,
// not stored on the backend (REQ-20260511-0011: status untouched, verify
// modeled as an event via verified_at).
type DisplayStatus =
  | 'pending'
  | 'paid_unverified'
  | 'paid_verified'
  | 'completed'
  | 'cancelled';

interface OrderTimeline {
  id: string;
  event: string; // i18n key like 'supplier.orderDetail.eventCreated'
  time: string;
  detail?: string;
}

interface OrderDetail {
  id: number;
  orderNo: string;
  status: DisplayStatus;
  product: string;
  travelDate: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  customer: string;
  customerPhone: string;
  customerEmail: string;
  paymentMethod: string;
  paidAt: string;
  verificationCode: string;
  verifiedAt?: string;
  channel: string;
  createdAt: string;
  timeline: OrderTimeline[];
  remark?: string;
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function deriveStatus(order: BackendOrder): DisplayStatus {
  if (order.status === 'cancelled' || order.status === 'refunded') return 'cancelled';
  if (order.status === 'completed') return 'completed';
  if (order.status === 'pending') return 'pending';
  return order.verified_at ? 'paid_verified' : 'paid_unverified';
}

function mapBackendToView(order: BackendOrder): OrderDetail {
  const timeline: OrderTimeline[] = [];
  if (order.created_at) {
    timeline.push({
      id: 'tl-created',
      event: 'supplier.orderDetail.eventCreated',
      time: formatTime(order.created_at),
    });
  }
  if (order.payment_time) {
    timeline.push({
      id: 'tl-paid',
      event: 'supplier.orderDetail.eventPaid',
      time: formatTime(order.payment_time),
    });
  }
  if (order.accepted_at) {
    timeline.push({
      id: 'tl-accepted',
      event: 'supplier.orderDetail.eventConfirmed',
      time: formatTime(order.accepted_at),
    });
  }
  if (order.verified_at) {
    timeline.push({
      id: 'tl-verified',
      event: 'supplier.orderDetail.eventVerified',
      time: formatTime(order.verified_at),
    });
  }
  if (order.completed_at) {
    timeline.push({
      id: 'tl-completed',
      event: 'supplier.orderDetail.eventCompleted',
      time: formatTime(order.completed_at),
    });
  }

  return {
    id: order.id,
    orderNo: order.order_no,
    status: deriveStatus(order),
    product: order.product_name,
    travelDate: order.booking_date ? order.booking_date.slice(0, 10) : '',
    quantity: order.quantity,
    unitPrice: Number(order.unit_price) || 0,
    totalAmount: Number(order.total_price) || 0,
    currency: order.currency || 'AUD',
    customer: order.contact_name || order.user_name || '',
    customerPhone: order.contact_phone || order.user_phone || '',
    customerEmail: order.contact_email || order.user_email || '',
    paymentMethod: order.payment_method || '',
    paidAt: formatTime(order.payment_time),
    verificationCode: order.verification_code || '',
    verifiedAt: formatTime(order.verified_at),
    channel: order.channel || 'direct',
    createdAt: formatTime(order.created_at),
    timeline,
    remark: order.user_remark || order.supplier_remark || '',
  };
}

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

function getStepIndex(status: DisplayStatus): number {
  // pending = 0 (only Created past), paid_unverified = 2 (Created+Paid+Confirmed),
  // paid_verified = 3, completed = 4, cancelled = -1
  switch (status) {
    case 'pending':
      return 0;
    case 'paid_unverified':
      return 2;
    case 'paid_verified':
      return 3;
    case 'completed':
      return 4;
    case 'cancelled':
      return -1;
  }
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
  orderId,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const numericId = orderId ? Number(orderId) : NaN;

  const loadOrder = useCallback(async () => {
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setLoadError(t('supplier.orderDetail.notFound'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getSupplierOrder(numericId);
      setOrder(mapBackendToView(data));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setLoadError(t('supplier.orderDetail.notFound'));
      } else if (err instanceof ApiError && err.status === 403) {
        setLoadError(t('supplier.orderDetail.errForbidden'));
      } else {
        setLoadError(t('supplier.orderDetail.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [numericId, t]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const currentStepIdx = order ? getStepIndex(order.status) : 0;

  /* ------ helpers ------ */

  const statusLabelKey = order
    ? `supplier.orderDetail.status${
        order.status.charAt(0).toUpperCase() + order.status.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      }`
    : '';

  const statusClass = (() => {
    if (!order) return '';
    const map: Record<DisplayStatus, string> = {
      pending: styles.statusPending,
      paid_unverified: styles.statusConfirmed,
      paid_verified: styles.statusVerified,
      completed: styles.statusCompleted,
      cancelled: styles.statusCancelled,
    };
    return map[order.status] ?? '';
  })();

  const productName = order?.product ?? '';

  /* ------ verify action ------ */

  const handleVerify = () => {
    setCodeInput('');
    setVerifyError(null);
    setShowConfirmModal(true);
  };

  const verifyErrorForCode = (code?: string): string => {
    switch (code) {
      case 'invalid_code':
        return t('supplier.orderDetail.errInvalidCode');
      case 'already_verified':
        return t('supplier.orderDetail.errAlreadyVerified');
      case 'invalid_status':
        return t('supplier.orderDetail.errInvalidStatus');
      case 'forbidden':
        return t('supplier.orderDetail.errForbidden');
      default:
        return t('supplier.orderDetail.errGeneric');
    }
  };

  const confirmVerify = async () => {
    if (!order) return;
    const code = codeInput.trim();
    if (!code) {
      setVerifyError(t('supplier.orderDetail.errCodeRequired'));
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      const updated = await verifySupplierOrder(order.id, code);
      setOrder(mapBackendToView(updated));
      setShowConfirmModal(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setVerifyError(verifyErrorForCode(err.code));
      } else {
        setVerifyError(t('supplier.orderDetail.errGeneric'));
      }
    } finally {
      setVerifying(false);
    }
  };

  /* ------ timeline item state helper ------ */

  const getItemState = (stepIdx: number) => {
    if (!order || order.status === 'cancelled') return 'future';
    if (stepIdx < currentStepIdx) return 'past';
    if (stepIdx === currentStepIdx) return 'current';
    return 'future';
  };

  const getTimeForStep = (eventKey: string): string => {
    if (!order) return '';
    const entry = order.timeline.find((tl) => tl.event === eventKey);
    return entry?.time ?? '';
  };

  const getDetailForStep = (eventKey: string): string | undefined => {
    if (!order) return undefined;
    const entry = order.timeline.find((tl) => tl.event === eventKey);
    return entry?.detail;
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>{t('supplier.orderDetail.loading')}</div>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            className={styles.backBtn}
            onClick={() => onNavigate?.('/supplier/orders')}
            aria-label={t('supplier.orderDetail.backToList')}
          >
            <ArrowLeft size={18} />
          </button>
        </div>
        <div className={styles.errorState}>
          {loadError ?? t('supplier.orderDetail.notFound')}
        </div>
      </div>
    );
  }

  const canVerify = order.status === 'paid_unverified';

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
          {canVerify && (
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

          {/* Customer contact */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <h3 className={styles.infoCardTitle}>
                {t('supplier.orderDetail.travelers')}
              </h3>
            </div>
            <div className={styles.infoCardBody}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  {t('supplier.orderDetail.customerName')}
                </span>
                <span className={styles.infoValue}>{order.customer || '--'}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  {t('supplier.orderDetail.customerPhone')}
                </span>
                <span className={styles.infoValue}>{order.customerPhone || '--'}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  {t('supplier.orderDetail.customerEmail')}
                </span>
                <span className={styles.infoValue}>{order.customerEmail || '--'}</span>
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

            {canVerify && (
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
            onClick={() => !verifying && setShowConfirmModal(false)}
          />
          <div className={styles.confirmBox}>
            <h3 className={styles.confirmTitle}>
              {t('supplier.orderDetail.verifyConfirm')}
            </h3>
            <p className={styles.confirmDesc}>
              {t('supplier.orderDetail.verifyCodePrompt')}
            </p>
            <input
              type="text"
              className={styles.confirmInput}
              value={codeInput}
              autoFocus
              placeholder="VRF-XXXXXX"
              onChange={(e) => {
                setCodeInput(e.target.value);
                if (verifyError) setVerifyError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !verifying) void confirmVerify();
              }}
              disabled={verifying}
            />
            {verifyError && (
              <div className={styles.confirmError}>{verifyError}</div>
            )}
            <div className={styles.confirmActions}>
              <button
                className={styles.confirmCancelBtn}
                onClick={() => setShowConfirmModal(false)}
                disabled={verifying}
              >
                {t('supplier.orderDetail.cancel')}
              </button>
              <button
                className={styles.confirmOkBtn}
                onClick={confirmVerify}
                disabled={verifying || !codeInput.trim()}
              >
                {verifying
                  ? t('supplier.orderDetail.verifying')
                  : t('supplier.orderDetail.verify')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierOrderDetailPage;
