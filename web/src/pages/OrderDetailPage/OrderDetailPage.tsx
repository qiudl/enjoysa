import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
const TravelReminder = lazy(() => import('../../components/AI/TravelReminder/TravelReminder'));
import { Header, Footer, Loading } from '../../components/Common';
import { OrderDetail } from '../../components/Order';
import { getOrder, cancelOrder, type Order as ApiOrder } from '../../services/orderService';
import { post, ApiError } from '../../services/api';
import type { Order, OrderStatus } from '../../types';
import styles from './OrderDetailPage.module.css';

export interface OrderDetailPageProps {
  orderId?: string;
  cartCount?: number;
  /** URL search params status: success | cancel */
  paymentStatus?: string | null;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onClearPaymentStatus?: () => void;
}

const statusMap: Record<string, OrderStatus> = {
  pending: 'pending_payment',
  paid: 'paid',
  accepted: 'confirmed',
  processing: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  refunded: 'refunded',
};

function transformOrder(o: ApiOrder): Order {
  return {
    id: o.order_no || String(o.id),
    numericId: o.id,
    orderNumber: o.order_no || String(o.id),
    userId: String(o.user_id),
    items: [{
      id: `item-${o.id}`,
      productId: String(o.product_id),
      productTitle: o.product_name,
      productTitleEn: o.product_name,
      productImage: '',
      quantity: o.quantity || o.guest_count,
      unitPrice: o.unit_price,
      subtotal: o.total_price,
      travelDate: o.booking_date,
      participants: [{ type: 'adult' as const, count: o.guest_count || o.quantity }],
    }],
    status: statusMap[o.status] || 'pending_payment',
    totalAmount: o.total_price,
    currency: (o.currency || 'AUD') as 'AUD' | 'CNY',
    paymentMethod: o.payment_method as Order['paymentMethod'],
    paymentStatus: o.status === 'pending' ? 'unpaid' : o.status === 'refunded' ? 'refunded' : 'paid',
    contactInfo: {
      name: o.contact_name,
      phone: o.contact_phone,
      email: o.contact_email,
    },
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    paidAt: o.payment_time,
    completedAt: o.completed_at,
    cancelledAt: o.cancelled_at,
  };
}

export const OrderDetailPage: React.FC<OrderDetailPageProps> = ({
  orderId,
  cartCount = 0,
  paymentStatus,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onClearPaymentStatus,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';
  const [order, setOrder] = useState<Order | null>(null);
  const [rawOrder, setRawOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(!!paymentStatus);
  const [retrying, setRetrying] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const result = await getOrder(/^\d+$/.test(orderId) ? Number(orderId) : orderId);
      setRawOrder(result);
      setOrder(transformOrder(result));
      setError(null);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Auto-hide success banner after 4 seconds
  useEffect(() => {
    if (paymentStatus === 'success' && showBanner) {
      const timer = setTimeout(() => {
        setShowBanner(false);
        onClearPaymentStatus?.();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus, showBanner, onClearPaymentStatus]);

  const handleRetryPayment = async () => {
    if (!rawOrder || retrying) return;
    setRetrying(true);
    try {
      const result = await post<{ session_id: string; checkout_url: string }>(
        '/checkout/create-session',
        { order_id: rawOrder.id },
        'user',
      );
      if (result.checkout_url) {
        setRetrying(false);
        window.location.href = result.checkout_url;
        return;
      }
      throw new Error('Empty checkout_url from /checkout/create-session');
    } catch (err) {
      // REQ-20260509-0034: surface payment-init failures so the user knows
      // why the redirect didn't happen, instead of looking at a stuck button.
      console.error('[OrderDetail] retry-payment failed', err);
      const code = err instanceof ApiError ? err.code : undefined;
      const fallbackMsg = err instanceof Error ? err.message : String(err);
      const message = code === 'PAYMENT_DISABLED'
        ? t('checkout.payment.disabled', '支付服务暂时不可用，请稍后再试或联系客服')
        : t('checkout.payment.failed', '无法跳转支付页面：{{detail}}', { detail: fallbackMsg });
      alert(message);
    } finally {
      setRetrying(false);
    }
  };

  const handleCancel = async () => {
    if (!rawOrder) return;
    try {
      await cancelOrder(rawOrder.id);
      fetchOrder();
    } catch (err) {
      console.error('[OrderDetail] cancel failed', err);
      alert(t('order.cancelFailed', '取消订单失败：{{detail}}', {
        detail: err instanceof Error ? err.message : String(err),
      }));
    }
  };

  return (
    <div className={styles.page}>
      <Header
        isLoggedIn
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
      />

      <main className={styles.main}>
        <div className={styles.container}>
          {/* AI Travel Reminder */}
          {rawOrder && (
            <Suspense fallback={null}>
              <TravelReminder orderId={rawOrder.id} productId={rawOrder.product_id} bookingDate={rawOrder.booking_date} />
            </Suspense>
          )}

          {/* Payment Status Banner */}
          {showBanner && paymentStatus === 'success' && (
            <div className={styles.successBanner}>
              <span className={styles.bannerIcon}>&#10003;</span>
              <span>{t('payment.paymentSuccessBanner')}</span>
            </div>
          )}

          {showBanner && paymentStatus === 'cancel' && (
            <div className={styles.cancelBanner}>
              <span>{t('payment.paymentCancelled')}</span>
              <span className={styles.cancelHint}>{t('payment.paymentCancelledHint')}</span>
              <button
                className={styles.retryBtn}
                onClick={handleRetryPayment}
                disabled={retrying}
              >
                {retrying ? t('common.loading') : t('payment.retryPayment')}
              </button>
            </div>
          )}

          {loading ? (
            <div className={styles.loadingContainer}>
              <Loading size="lg" />
            </div>
          ) : error ? (
            <div className={styles.errorContainer}>
              <p>{error}</p>
              <button onClick={fetchOrder}>{t('common.retry')}</button>
            </div>
          ) : order ? (
            <OrderDetail
              order={order}
              language={currentLang}
              onPay={handleRetryPayment}
              onCancel={handleCancel}
            />
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default OrderDetailPage;
