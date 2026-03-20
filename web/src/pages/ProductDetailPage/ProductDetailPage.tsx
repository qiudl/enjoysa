import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  Button,
  Loading,
  GoogleMap,
} from '../../components/Common';
import type { Product } from '../../types';
import { productService, transformApiProduct } from '../../services/productService';
import type { ApiProductSchedule } from '../../services/productService';
import styles from './ProductDetailPage.module.css';

export interface ProductDetailPageProps {
  /** 当前语言 */
  language?: 'zh' | 'en';
  /** 是否登录 */
  isLoggedIn?: boolean;
  /** 用户名 */
  userName?: string;
  /** 购物车数量 */
  cartCount?: number;
  /** 产品ID */
  productId?: string;
  /** 加载中 */
  loading?: boolean;
  /** 登录点击 */
  onLoginClick?: () => void;
  /** 注册点击 */
  onRegisterClick?: () => void;
  /** 导航点击 */
  onNavClick?: (path: string) => void;
  /** 立即预订 */
  onBookNow?: () => void;
  /** 加入购物车 */
  onAddToCart?: (product: Product, selectedDate?: string, selectedTime?: string) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  language,
  isLoggedIn = false,
  userName,
  cartCount = 0,
  productId,
  loading: externalLoading = false,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onBookNow,
  onAddToCart,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = language || (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';
  const [selectedDate, setSelectedDate] = useState('');
  const [quantity, setQuantity] = useState(2);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ApiProductSchedule[]>([]);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    const numId = Number(productId);
    Promise.all([
      productService.getById(numId).then((apiProduct) => {
        setProduct(transformApiProduct(apiProduct));
      }),
      productService.getSchedules(numId).then((s) => {
        setSchedules(s || []);
      }).catch(() => {}),
    ])
      .catch(() => {
        // product not found
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const isLoading = loading || externalLoading || !product;

  if (isLoading) {
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
        <div className={styles.loadingContainer}>
          <Loading size="lg" />
        </div>
        <Footer />
      </div>
    );
  }

  const title = currentLang === 'en' && product.titleEn ? product.titleEn : product.title;
  const location = currentLang === 'en' && product.locationEn ? product.locationEn : product.location;
  const duration = currentLang === 'en' && product.durationEn ? product.durationEn : product.duration;
  const meetingPoint = product.meetingPoint;

  const totalPrice = product.price * quantity;

  const handleBook = () => {
    if (selectedDate && onBookNow) {
      onBookNow();
    }
  };

  const handleAddToCart = () => {
    if (selectedDate && onAddToCart) {
      onAddToCart(product, selectedDate);
    }
  };

  // Generate next 7 days for date selection, using real schedule data when available
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    const scheduleDates = new Set(schedules.map((s) => s.date));
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      // Available if: no schedules exist yet (open booking) or schedule exists with remaining slots
      const schedule = schedules.find((s) => s.date === dateStr);
      const available = scheduleDates.size === 0
        ? true
        : schedule ? (schedule.total_slots - schedule.booked_slots > 0 && schedule.status === 'active') : false;
      dates.push({
        value: dateStr,
        label: date.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US', {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
        }),
        available,
      });
    }
    return dates;
  };

  const availableDates = getAvailableDates();

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
          {/* Image Gallery */}
          <section className={styles.gallery}>
            <div className={styles.mainImage}>
              <img
                src={product.images[currentImageIndex]}
                alt={title}
                className={styles.image}
              />
              {product.originalPrice && (
                <span className={styles.discountBadge}>
                  {Math.round((1 - product.price / product.originalPrice) * 100)}% OFF
                </span>
              )}
            </div>
            <div className={styles.thumbnails}>
              {product.images.map((img, index) => (
                <button
                  key={index}
                  className={`${styles.thumbnail} ${index === currentImageIndex ? styles.active : ''}`}
                  onClick={() => setCurrentImageIndex(index)}
                >
                  <img src={img} alt={`${title} ${index + 1}`} />
                </button>
              ))}
            </div>
          </section>

          {/* Content */}
          <div className={styles.content}>
            {/* Product Info */}
            <section className={styles.productInfo}>
              <h1 className={styles.title}>{title}</h1>

              <div className={styles.meta}>
                <span className={styles.rating}>
                  ⭐ {product.rating.toFixed(1)}
                </span>
                <span className={styles.reviewCount}>
                  ({product.reviewCount} {t('product.reviews')})
                </span>
                <span className={styles.location}>📍 {location}</span>
              </div>

              <div className={styles.badges}>
                {product.instantConfirmation && (
                  <span className={styles.badge}>⚡ {t('product.instantConfirmation')}</span>
                )}
                {product.freeCancellation && (
                  <span className={styles.badge}>✓ {t('product.freeCancellation')}</span>
                )}
              </div>

              <p className={styles.description}>{product.description}</p>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>⏱ {t('product.duration')}</span>
                  <span className={styles.infoValue}>{duration}</span>
                </div>
                {meetingPoint && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>📍 {t('product.meetingPoint')}</span>
                    <span className={styles.infoValue}>{meetingPoint}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Location Map */}
            {location && (
              <section className={styles.mapSection}>
                <h2 className={styles.sectionTitle}>{t('product.locationMap')}</h2>
                <GoogleMap
                  address={product.locationEn || product.location}
                  title={title}
                  height={300}
                />
                {meetingPoint && meetingPoint !== location && (
                  <p className={styles.meetingPointNote}>
                    📍 {t('product.meetingPoint')}: {meetingPoint}
                  </p>
                )}
              </section>
            )}

            {/* Highlights */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t('product.highlights')}</h2>
              <ul className={styles.highlightsList}>
                {product.highlights.map((item, index) => (
                  <li key={index}>✨ {item}</li>
                ))}
              </ul>
            </section>

            {/* Inclusions & Exclusions */}
            <div className={styles.inclusionsGrid}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('product.inclusions')}</h2>
                <ul className={styles.list}>
                  {product.inclusions.map((item, index) => (
                    <li key={index} className={styles.included}>✓ {item}</li>
                  ))}
                </ul>
              </section>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('product.exclusions')}</h2>
                <ul className={styles.list}>
                  {product.exclusions.map((item, index) => (
                    <li key={index} className={styles.excluded}>✗ {item}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>

          {/* Booking Card */}
          <aside className={styles.bookingCard}>
            <div className={styles.priceSection}>
              <div className={styles.price}>
                <span className={styles.currency}>¥</span>
                <span className={styles.amount}>{product.price}</span>
                <span className={styles.suffix}>{t('product.perPerson')}</span>
              </div>
              {product.originalPrice && (
                <span className={styles.originalPrice}>
                  {t('product.originalPrice')} ¥{product.originalPrice}
                </span>
              )}
            </div>

            {/* Date Selection */}
            <div className={styles.bookingSection}>
              <label className={styles.label}>{t('product.selectDate')}</label>
              <div className={styles.dateGrid}>
                {availableDates.map((date) => (
                  <button
                    key={date.value}
                    className={`${styles.dateButton} ${selectedDate === date.value ? styles.selected : ''} ${!date.available ? styles.disabled : ''}`}
                    onClick={() => date.available && setSelectedDate(date.value)}
                    disabled={!date.available}
                  >
                    <span className={styles.dateLabel}>{date.label}</span>
                    <span className={styles.availability}>
                      {date.available ? t('product.available') : t('product.soldOut')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Selection */}
            <div className={styles.bookingSection}>
              <label className={styles.label}>{t('product.selectParticipants')}</label>
              <div className={styles.quantitySelector}>
                <span>{t('order.adults')}</span>
                <div className={styles.quantityControls}>
                  <button
                    className={styles.quantityBtn}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <span className={styles.quantityValue}>{quantity}</span>
                  <button
                    className={styles.quantityBtn}
                    onClick={() => setQuantity(Math.min(10, quantity + 1))}
                    disabled={quantity >= 10}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Total Price */}
            <div className={styles.totalSection}>
              <span className={styles.totalLabel}>{t('product.totalPrice')}</span>
              <span className={styles.totalPrice}>¥{totalPrice}</span>
            </div>

            {/* Action Buttons */}
            <div className={styles.actions}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!selectedDate}
                onClick={handleBook}
              >
                {t('product.buyNow')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                disabled={!selectedDate}
                onClick={handleAddToCart}
              >
                {t('product.addToCart')}
              </Button>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetailPage;
