import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Calendar, Users, MapPin, Clock, Tag, Shield, Check } from 'lucide-react';
import styles from './OrderSummary.module.css';
import type { Product, CartItem } from '../../../types';
import { formatPrice } from '../../../utils/formatPrice';

export interface OrderSummaryProps {
  /** 产品信息 */
  product: Product;
  /** 购物车项（包含日期、人数等） */
  cartItem?: CartItem;
  /** 出行日期 */
  travelDate?: string;
  /** 成人数量 */
  adultCount?: number;
  /** 儿童数量 */
  childCount?: number;
  /** 优惠码 */
  couponCode?: string;
  /** 优惠金额 */
  discountAmount?: number;
  /** 是否显示详情 */
  showDetails?: boolean;
  /** 语言 */
  language?: 'zh' | 'en';
  /** 覆盖单价（套餐/时段价格优先于 product.price） */
  unitPrice?: number;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  product,
  cartItem,
  travelDate,
  adultCount = 1,
  childCount = 0,
  couponCode,
  discountAmount = 0,
  showDetails = true,
  language,
  unitPrice: unitPriceOverride,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const title = isZh ? product.title : product.titleEn;
  const location = isZh ? product.location : product.locationEn;
  const duration = isZh ? product.duration : product.durationEn;

  // Calculate prices
  const actualTravelDate = cartItem?.travelDate || cartItem?.selectedDate || travelDate;
  const actualAdultCount = cartItem?.quantity || adultCount;
  const actualChildCount = childCount;

  const effectivePrice = unitPriceOverride ?? product.price;
  const adultPrice = effectivePrice * actualAdultCount;
  const childPrice = effectivePrice * 0.5 * actualChildCount; // Assume 50% for children
  const subtotal = adultPrice + childPrice;
  const total = subtotal - discountAmount;

  return (
    <div className={styles.container}>
      {/* Product Info */}
      <div className={styles.productSection}>
        <div className={styles.imageWrapper}>
          <img
            src={product.images[0]}
            alt={title}
            className={styles.image}
          />
        </div>
        <div className={styles.productInfo}>
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <MapPin size={14} />
              {location}
            </span>
            <span className={styles.metaItem}>
              <Clock size={14} />
              {duration}
            </span>
          </div>
        </div>
      </div>

      {/* Booking Details */}
      {showDetails && (
        <div className={styles.detailsSection}>
          <h4 className={styles.sectionTitle}>{t('order.bookingDetails')}</h4>

          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>
              <Calendar size={16} />
              {t('order.travelDate')}
            </span>
            <span className={styles.detailValue}>
              {actualTravelDate || t('order.selectDate')}
            </span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>
              <Users size={16} />
              {t('order.participants')}
            </span>
            <span className={styles.detailValue}>
              {actualAdultCount} {t('order.adults')}
              {actualChildCount > 0 && `, ${actualChildCount} ${t('order.children')}`}
            </span>
          </div>
        </div>
      )}

      {/* Price Breakdown */}
      <div className={styles.priceSection}>
        <h4 className={styles.sectionTitle}>{t('order.priceBreakdown')}</h4>

        <div className={styles.priceRow}>
          <span className={styles.priceLabel}>
            {t('order.adultPrice')} x {actualAdultCount}
          </span>
          <span className={styles.priceValue}>
            {formatPrice(adultPrice, product.currency)}
          </span>
        </div>

        {actualChildCount > 0 && (
          <div className={styles.priceRow}>
            <span className={styles.priceLabel}>
              {t('order.childPrice')} x {actualChildCount}
            </span>
            <span className={styles.priceValue}>
              {formatPrice(childPrice, product.currency)}
            </span>
          </div>
        )}

        <div className={styles.priceRow}>
          <span className={styles.priceLabel}>{t('order.subtotal')}</span>
          <span className={styles.priceValue}>{formatPrice(subtotal, product.currency)}</span>
        </div>

        {discountAmount > 0 && (
          <div className={clsx(styles.priceRow, styles.discount)}>
            <span className={styles.priceLabel}>
              <Tag size={14} />
              {t('order.couponDiscount')}
              {couponCode && <span className={styles.couponCode}>({couponCode})</span>}
            </span>
            <span className={styles.priceValue}>-{formatPrice(discountAmount, product.currency)}</span>
          </div>
        )}

        <div className={clsx(styles.priceRow, styles.total)}>
          <span className={styles.priceLabel}>{t('order.total')}</span>
          <span className={styles.totalValue}>
            {formatPrice(total, product.currency)}
          </span>
        </div>
      </div>

      {/* Product Features */}
      <div className={styles.featuresSection}>
        {product.instantConfirmation && (
          <div className={styles.feature}>
            <Check size={16} className={styles.featureIcon} />
            <span>{t('product.instantConfirmation')}</span>
          </div>
        )}
        {product.freeCancellation && (
          <div className={styles.feature}>
            <Shield size={16} className={styles.featureIcon} />
            <span>{t('product.freeCancellation')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderSummary;
