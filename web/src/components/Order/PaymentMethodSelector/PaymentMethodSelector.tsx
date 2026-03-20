import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { CreditCard, Smartphone, Building, Check } from 'lucide-react';
import styles from './PaymentMethodSelector.module.css';
import type { PaymentMethod } from '../../../types';

export interface PaymentMethodSelectorProps {
  /** 当前选中的支付方式 */
  selectedMethod?: PaymentMethod;
  /** 可用的支付方式 */
  availableMethods?: PaymentMethod[];
  /** 即将上线的支付方式（置灰显示 Coming Soon） */
  comingSoon?: PaymentMethod[];
  /** 选择支付方式回调 */
  onSelect?: (method: PaymentMethod) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

interface PaymentMethodConfig {
  id: PaymentMethod;
  icon: React.ReactNode;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  logo?: string;
}

const paymentMethods: PaymentMethodConfig[] = [
  {
    id: 'wechat',
    icon: <Smartphone size={24} />,
    label: '微信支付',
    labelEn: 'WeChat Pay',
    description: '使用微信扫码支付',
    descriptionEn: 'Pay with WeChat QR code',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/WeChat_logo.svg/120px-WeChat_logo.svg.png',
  },
  {
    id: 'alipay',
    icon: <Smartphone size={24} />,
    label: '支付宝',
    labelEn: 'Alipay',
    description: '使用支付宝扫码支付',
    descriptionEn: 'Pay with Alipay QR code',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Alipay_logo.svg/120px-Alipay_logo.svg.png',
  },
  {
    id: 'credit_card',
    icon: <CreditCard size={24} />,
    label: '信用卡/借记卡',
    labelEn: 'Credit/Debit Card',
    description: '支持 Visa、Mastercard · 由 Stripe 安全处理',
    descriptionEn: 'Visa, Mastercard · Secured by Stripe',
  },
  {
    id: 'paypal',
    icon: <CreditCard size={24} />,
    label: 'PayPal',
    labelEn: 'PayPal',
    description: '使用 PayPal 账户支付',
    descriptionEn: 'Pay with your PayPal account',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/120px-PayPal.svg.png',
  },
  {
    id: 'bank_transfer',
    icon: <Building size={24} />,
    label: '银行转账',
    labelEn: 'Bank Transfer',
    description: '线下银行转账（需人工确认）',
    descriptionEn: 'Offline bank transfer (manual confirmation required)',
  },
];

const defaultMethods: PaymentMethod[] = ['wechat', 'alipay', 'credit_card', 'paypal'];

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  availableMethods = defaultMethods,
  comingSoon = [],
  onSelect,
  disabled = false,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  const filteredMethods = paymentMethods.filter(method =>
    availableMethods.includes(method.id)
  );

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{t('payment.selectMethod')}</h3>

      <div className={styles.methods}>
        {filteredMethods.map(method => {
          const isComingSoon = comingSoon.includes(method.id);
          return (
            <button
              key={method.id}
              className={clsx(styles.method, {
                [styles.selected]: selectedMethod === method.id && !isComingSoon,
                [styles.disabled]: disabled || isComingSoon,
              })}
              onClick={() => !disabled && !isComingSoon && onSelect?.(method.id)}
              disabled={disabled || isComingSoon}
              type="button"
            >
              <div className={styles.methodIcon}>
                {method.logo ? (
                  <img src={method.logo} alt={method.label} className={styles.logo} />
                ) : (
                  method.icon
                )}
              </div>

              <div className={styles.methodInfo}>
                <span className={styles.methodLabel}>
                  {isZh ? method.label : method.labelEn}
                </span>
                <span className={styles.methodDescription}>
                  {isZh ? method.description : method.descriptionEn}
                </span>
              </div>

              {isComingSoon ? (
                <span className={styles.comingSoonBadge}>
                  {t('payment.comingSoon')}
                </span>
              ) : (
                <div className={clsx(styles.checkmark, { [styles.visible]: selectedMethod === method.id })}>
                  <Check size={16} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Security Notice */}
      <div className={styles.securityNotice}>
        <span className={styles.securityIcon}>🔒</span>
        <span className={styles.securityText}>
          {t('payment.securityNotice')}
        </span>
      </div>
    </div>
  );
};

export default PaymentMethodSelector;
