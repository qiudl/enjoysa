import React, { useState } from 'react';
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
import type { Product, Destination, ProductCategory, ParticipantDetail, PaymentMethod } from '../../types';
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

// Mock destination and category for product
const mockDestination: Destination = {
  id: 'kangaroo-island',
  name: '袋鼠岛',
  nameEn: 'Kangaroo Island',
  region: '南澳大利亚',
  regionEn: 'South Australia',
};

const mockCategory: ProductCategory = {
  id: 'day-tour',
  name: '一日游',
  nameEn: 'Day Tours',
};

// Mock product
const mockProduct: Product = {
  id: '1',
  title: '袋鼠岛一日游',
  titleEn: 'Kangaroo Island Day Tour',
  description: '探索南澳最著名的野生动物天堂',
  images: ['https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=400'],
  price: 389,
  currency: 'CNY',
  rating: 4.8,
  reviewCount: 126,
  location: '阿德莱德出发',
  locationEn: 'Depart from Adelaide',
  duration: '1天',
  durationEn: '1 Day',
  highlights: ['野生动物', '海豹湾', '神奇岩石'],
  inclusions: ['往返交通', '午餐', '导游'],
  exclusions: ['个人消费'],
  tags: ['hot', 'recommended'],
  category: mockCategory,
  destination: mockDestination,
  availability: 'available',
  instantConfirmation: true,
  freeCancellation: true,
  supplierId: 'sup-1',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
};

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
  isLoggedIn = true,
  userName,
  cartCount = 0,
  product = mockProduct,
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wechat');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

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

    setSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setSubmitting(false);

    // Generate mock order ID
    const orderId = `ORD-${Date.now()}`;

    onSubmit?.({
      product,
      participants,
      paymentMethod,
      travelDate,
    });

    if (onOrderSuccess) {
      onOrderSuccess(orderId);
    } else {
      setShowSuccess(true);
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

          <div className={styles.content}>
            {/* Left Column */}
            <div className={styles.leftColumn}>
              {/* Participant Info */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('participant.title')}</h2>
                <ParticipantForm
                  participants={participants}
                  onChange={handleParticipantsChange}
                  maxParticipants={adultCount}
                  minParticipants={1}
                  requirePassport
                />
              </section>

              {/* Payment Method */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('order.paymentMethod')}</h2>
                <PaymentMethodSelector
                  selectedMethod={paymentMethod}
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
                  disabled={!agreed || submitting}
                  loading={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? t('checkout.processing') : t('order.submitOrder')}
                </Button>
              </div>
            </div>
          </div>
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
