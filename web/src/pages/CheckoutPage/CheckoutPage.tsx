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
import type { CartItem } from '../../contexts/CartContext';
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
  /** 购物车商品（从购物车结算时传入） */
  cartItems?: CartItem[];
  /** 清空购物车 */
  onClearCart?: () => void;
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
  cartItems,
  onClearCart,
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

  // Cart mode: checkout multiple items from cart
  const isCartMode = !productId && cartItems && cartItems.length > 0;
  const [cartPackages, setCartPackages] = useState<Record<string, ApiProductPackage[]>>({});

  useEffect(() => {
    if (!isCartMode || !cartItems) return;
    setProductLoading(true);
    Promise.all(
      cartItems.map((item) =>
        productService
          .getById(Number(item.product.id))
          .then((apiProduct) => ({
            productId: item.product.id,
            packages: apiProduct.packages || [],
          }))
      )
    )
      .then((results) => {
        const pkgMap: Record<string, ApiProductPackage[]> = {};
        results.forEach((r) => {
          pkgMap[r.productId] = r.packages;
        });
        setCartPackages(pkgMap);
      })
      .catch(() => {})
      .finally(() => setProductLoading(false));
  }, [isCartMode, cartItems]);

  const cartTotal = cartItems?.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  ) || 0;

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

    if (!agreed) return;
    if (!isCartMode && !product) return;

    if (!validateParticipants()) {
      participantSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const contactName = participants[0]?.firstName
      ? `${participants[0].firstName} ${participants[0].lastName}`
      : '';
    const contactPhone = participants[0]?.phone || '';
    const contactEmail = participants[0]?.email || '';

    setSubmitting(true);

    try {
      if (isCartMode && cartItems) {
        // Cart mode: create one order per cart item
        let firstOrderId = '';
        for (const item of cartItems) {
          const pkgs = cartPackages[item.product.id];
          const packageId = pkgs?.[0]?.id;
          if (!packageId) continue;

          const order = await createOrder({
            product_id: Number(item.product.id),
            package_id: packageId,
            quantity: item.quantity,
            booking_date: item.selectedDate || travelDate,
            contact_name: contactName,
            contact_phone: contactPhone,
            contact_email: contactEmail,
          });
          if (!firstOrderId) {
            firstOrderId = order.order_no || String(order.id);
          }
        }

        onClearCart?.();

        if (onOrderSuccess && firstOrderId) {
          onOrderSuccess(firstOrderId);
        } else {
          setShowSuccess(true);
        }
      } else {
        // Single product mode
        const packageId = packages[0]?.id;
        if (!packageId) return;

        const order = await createOrder({
          product_id: Number(product!.id),
          package_id: packageId,
          quantity: adultCount,
          booking_date: travelDate,
          contact_name: contactName,
          contact_phone: contactPhone,
          contact_email: contactEmail,
        });

        const orderId = order.order_no || String(order.id);
        const orderNumericId = order.id;

        onSubmit?.({
          product: product!,
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
          ) : !isCartMode && !product ? (
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
                  maxParticipants={isCartMode ? 1 : adultCount}
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

                {isCartMode && cartItems ? (
                  /* Cart mode: show all cart items */
                  <div className={styles.cartSummary}>
                    {cartItems.map((item) => {
                      const itemTitle = currentLang === 'en' && item.product.titleEn
                        ? item.product.titleEn
                        : item.product.title;
                      return (
                        <div key={item.product.id} className={styles.cartSummaryItem}>
                          <img
                            src={item.product.images[0]}
                            alt={itemTitle}
                            className={styles.cartSummaryImage}
                          />
                          <div className={styles.cartSummaryInfo}>
                            <h4 className={styles.cartSummaryTitle}>{itemTitle}</h4>
                            <p className={styles.cartSummaryMeta}>
                              {item.selectedDate && <span>{item.selectedDate}</span>}
                              <span>{item.quantity} x ¥{item.product.price}</span>
                            </p>
                            <span className={styles.cartSummaryPrice}>
                              ¥{(item.product.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div className={styles.cartSummaryTotal}>
                      <span>{t('order.total')}</span>
                      <span className={styles.cartSummaryTotalPrice}>¥{cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                ) : product ? (
                  <OrderSummary
                    product={product}
                    travelDate={travelDate}
                    adultCount={adultCount}
                    language={currentLang}
                  />
                ) : null}

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
                  disabled={!agreed || submitting || productLoading || (isCartMode ? Object.keys(cartPackages).length === 0 : !packages[0])}
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
