import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  Button,
  Loading,
} from '../../components/Common';
import type { Product, Destination, ProductCategory } from '../../types';
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

// Mock destination and category
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

// Mock product data
const mockProduct: Product = {
  id: '1',
  title: '袋鼠岛一日游 - 野生动物探索之旅',
  titleEn: 'Kangaroo Island Day Tour - Wildlife Discovery',
  description: '探索南澳最著名的野生动物天堂，近距离观赏袋鼠、考拉、海豹等珍稀动物。',
  images: [
    'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=800',
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
    'https://images.unsplash.com/photo-1564760055775-d63b17a55c44?w=800',
  ],
  price: 389,
  originalPrice: 459,
  currency: 'CNY',
  rating: 4.8,
  reviewCount: 126,
  location: '阿德莱德出发',
  locationEn: 'Depart from Adelaide',
  duration: '约12小时',
  durationEn: 'Approx. 12 hours',
  highlights: [
    '近距离观赏野生袋鼠和考拉',
    '海豹湾与海豹亲密接触',
    '神奇岩石打卡拍照',
    '品尝当地特色午餐',
    '专业中文导游全程讲解',
  ],
  inclusions: [
    '阿德莱德往返接送',
    '渡轮船票',
    '景点门票',
    '午餐',
    '中文导游服务',
  ],
  exclusions: [
    '个人消费',
    '旅游保险',
    '酒店住宿',
  ],
  tags: ['hot', 'recommended'],
  category: mockCategory,
  destination: mockDestination,
  availability: 'available',
  instantConfirmation: true,
  freeCancellation: true,
  meetingPoint: '阿德莱德市中心指定酒店',
  supplierId: 'sup-1',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
};


export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  language,
  isLoggedIn = false,
  userName,
  cartCount = 0,
  loading = false,
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
  const product = mockProduct;

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

  // Generate next 7 days for date selection
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        value: date.toISOString().split('T')[0],
        label: date.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US', {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
        }),
        available: i !== 3, // Mock: day 3 is sold out
      });
    }
    return dates;
  };

  const availableDates = getAvailableDates();

  if (loading) {
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
