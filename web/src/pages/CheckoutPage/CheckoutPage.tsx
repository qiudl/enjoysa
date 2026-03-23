import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  Button,
  Modal,
} from '../../components/Common';
import {
  OrderSummary,
  PaymentMethodSelector,
  ParticipantForm,
} from '../../components/Order';
import type { Product, ParticipantDetail, PaymentMethod } from '../../types';
import { createOrder } from '../../services/orderService';
import { post } from '../../services/api';
import { productService, transformApiProduct, type ApiProductPackage } from '../../services/productService';
import styles from './CheckoutPage.module.css';

export interface CheckoutPageProps {
  /** 当前语言 */
  language?: 'zh' | 'en';
  /** 是否登录 */
  isLoggedIn?: boolean;
  /** 用户名 */
  userName?: string;
  /** 购物车数量 */
  cartCount?: number;
  /** 产品信息 */
  product?: Product;
  /** 产品 ID（从路由 state 传入，用于获取真实产品数据） */
  productId?: string;
  /** 出行日期 */
  travelDate?: string;
  /** 成人数量 */
  adultCount?: number;
  /** 提交订单 */
  onSubmit?: (data: {
    product: Product;
    participants: ParticipantDetail[];
    paymentMethod: PaymentMethod;
    travelDate: string;
  }) => void;
  /** 返回 */
  onBack?: () => void;
  /** 登录点击 */
  onLoginClick?: () => void;
  /** 注册点击 */
  onRegisterClick?: () => void;
  /** 导航点击 */
  onNavClick?: (path: string) => void;
  /** 订单成功回调 */
  onOrderSuccess?: (orderId: string) => void;
  /** 需要登录回调 */
  onLoginRequired?: () => void;
}

// Default participant
const createDefaultParticipant = (): ParticipantDetail => ({
  id: `p-${Date.now()}`,
  type: 'adult',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  nationality: '',
  passportNumber: '',
  specialRequirements: '',
});

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  language,
  isLoggedIn = false,
  userName,
  cartCount = 0,
  product: productProp,
  productId,
  travelDate = '2026-02-15',
  adultCount = 2,
  onSubmit,
  onBack,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onOrderSuccess,
  onLoginRequired,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = language || (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';
  const [participants, setParticipants] = useState<ParticipantDetail[]>([
    createDefaultParticipant(),
  ]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [participantErrors, setParticipantErrors] = useState<Record<number, Record<string, string>>>({});
  const participantSectionRef = useRef<HTMLElement>(null);

  // Fetch real product data (with packages) when productId is provided
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [packages, setPackages] = useState<ApiProductPackage[]>([]);
  const [productLoading, setProductLoading] = useState(!!productId);

  useEffect(() => {
    if (!productId) return;
    setProductLoading(true);
    productService.getById(Number(productId))
      .then((apiProduct) => {
        setFetchedProduct(transformApiProduct(apiProduct));
        setPackages(apiProduct.packages || []);
      })
      .catch(() => {})
      .finally(() => setProductLoading(false));
  }, [productId]);

  const product = fetchedProduct || productProp;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateParticipants = useCallback((): boolean => {
    const errs: Record<number, Record<string, string>> = {};
    let valid = true;

    participants.forEach((p, i) => {
      const fieldErrs: Record<string, string> = {};
      if (!p.firstName.trim()) fieldErrs.firstName = t('checkout.errors.firstNameRequired');
      if (!p.lastName.trim()) fieldErrs.lastName = t('checkout.errors.lastNameRequired');
      if (!p.email?.trim()) {
        fieldErrs.email = t('checkout.errors.emailRequired');
      } else if (!EMAIL_RE.test(p.email)) {
        fieldErrs.email = t('checkout.errors.emailInvalid');
      }
      if (!p.phone?.trim()) fieldErrs.phone = t('checkout.errors.phoneRequired');
      if (!p.passportNumber?.trim()) fieldErrs.passportNumber = t('checkout.errors.passportRequired');
      if (Object.keys(fieldErrs).length > 0) {
        errs[i] = fieldErrs;
        valid = false;
      }
    });

    setParticipantErrors(errs);
    return valid;
  }, [participants, t]);

  const handleFieldChange = useCallback((index: number, field: string) => {
    setParticipantErrors(prev => {
      const next = { ...prev };
      if (next[index]) {
        const { [field]: _, ...rest } = next[index];
        if (Object.keys(rest).length === 0) {
          delete next[index];
        } else {
          next[index] = rest;
        }
      }
      return next;
    });
  }, []);

  const handleParticipantsChange = (updatedParticipants: ParticipantDetail[]) => {
    setParticipants(updatedParticipants);
  };

  const handlePaymentSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
  };

  const handleSubmit = async () => {
    if (!isLoggedIn) {
      if (onLoginRequired) {
        onLoginRequired();
      } else {
        setShowLoginModal(true);
      }
      return;
    }

    if (!agreed || !product) return;

    if (!validateParticipants()) {
      participantSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // Ensure we have a valid package
    const packageId = packages[0]?.id;
    if (!packageId) {
      // Cannot create order without a valid package
      return;
    }

    setSubmitting(true);

    try {
      const order = await createOrder({
        product_id: Number(product.id),
        package_id: packageId,
        quantity: adultCount,
        booking_date: travelDate,
        contact_name: participants[0]?.firstName
          ? `${participants[0].firstName} ${participants[0].lastName}`
          : '',
        contact_phone: participants[0]?.phone || '',
        contact_email: participants[0]?.email || '',
      });

      const orderId = order.order_no || String(order.id);
      const orderNumericId = order.id;

      onSubmit?.({
        product,
        participants,
        paymentMethod,
        travelDate,
      });

      // Attempt Stripe checkout if payment gateway is available
      if (paymentMethod === 'stripe' || paymentMethod === 'credit_card') {
        try {
          const checkoutResult = await post<{ session_id: string; checkout_url: string }>(
            '/checkout/create-session',
            { order_id: orderNumericId },
            'user',
          );
          if (checkoutResult.checkout_url) {
            window.location.href = checkoutResult.checkout_url;
            return;
          }
        } catch {
          // Stripe not configured — fall through to success page
        }
      }

      if (onOrderSuccess) {
        onOrderSuccess(orderId);
      } else {
        setShowSuccess(true);
      }
    } catch {
      // order creation failed — could show error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Header
        isLoggedIn={isLoggedIn}
        userName={userName}
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
      />

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Back Button & Title */}
          <div className={styles.header}>
            <button className={styles.backBtn} onClick={onBack}>
              ← {t('common.back')}
            </button>
            <h1 className={styles.title}>{t('checkout.title')}</h1>
          </div>

          {productLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#64748b' }}>
              {t('common.loading', 'Loading...')}
            </div>
          ) : !product ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
              {t('common.notFound', 'Product not found')}
            </div>
          ) : (
          <div className={styles.content}>
            {/* Left Column */}
            <div className={styles.leftColumn}>
              {/* Participant Info */}
              <section className={styles.section} ref={participantSectionRef}>
                <h2 className={styles.sectionTitle}>{t('participant.title')}</h2>
                <ParticipantForm
                  participants={participants}
                  onChange={handleParticipantsChange}
                  maxParticipants={adultCount}
                  minParticipants={1}
                  requirePassport
                  errors={participantErrors}
                  onFieldChange={handleFieldChange}
                  isAuthenticated
                />
              </section>

              {/* Payment Method */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('order.paymentMethod')}</h2>
                <PaymentMethodSelector
                  selectedMethod={paymentMethod}
                  availableMethods={['credit_card', 'wechat', 'alipay']}
                  comingSoon={['wechat', 'alipay']}
                  onSelect={handlePaymentSelect}
                />
              </section>
            </div>

            {/* Right Column - Order Summary */}
            <div className={styles.rightColumn}>
              <div className={styles.summaryCard}>
                <h2 className={styles.sectionTitle}>{t('order.orderSummary')}</h2>
                <OrderSummary
                  product={product}
                  travelDate={travelDate}
                  adultCount={adultCount}
                  language={currentLang}
                />

                {/* Agreement */}
                <label className={styles.agreement}>
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>
                    {t('auth.agreeTerms')}{' '}
                    <a href="/terms" target="_blank">{t('auth.termsOfService')}</a>{' '}
                    {t('auth.and')}{' '}
                    <a href="/privacy" target="_blank">{t('auth.privacyPolicy')}</a>
                  </span>
                </label>

                {/* Submit Button */}
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={!agreed || submitting || productLoading || !packages[0]}
                  loading={submitting || productLoading}
                  onClick={handleSubmit}
                >
                  {submitting ? t('checkout.processing') : t('order.submitOrder')}
                </Button>
              </div>
            </div>
          </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Login Modal */}
      <Modal
        open={showLoginModal}
        title={t('checkout.loginRequired')}
        size="sm"
        language={currentLang}
        onClose={() => setShowLoginModal(false)}
        onOk={() => {
          setShowLoginModal(false);
          onLoginClick?.();
        }}
      >
        <p>{t('checkout.loginToContinue')}</p>
      </Modal>

      {/* Success Modal */}
      <Modal
        open={showSuccess}
        title={t('checkout.successTitle')}
        size="sm"
        language={currentLang}
        hideFooter
        onClose={() => setShowSuccess(false)}
      >
        <div className={styles.successContent}>
          <span className={styles.successIcon}>✅</span>
          <p>{t('checkout.successMessage')}</p>
          <div className={styles.successActions}>
            <Button variant="primary" onClick={() => setShowSuccess(false)}>
              {t('checkout.viewOrder')}
            </Button>
            <Button variant="outline" onClick={() => setShowSuccess(false)}>
              {t('checkout.continueShopping')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CheckoutPage;
