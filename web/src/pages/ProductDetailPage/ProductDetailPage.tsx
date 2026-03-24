import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  onBookNow?: (quantity: number, selectedDate: string) => void;
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
  const [addedToCart, setAddedToCart] = useState(false);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  // Calendar state — must be before any early return to maintain hook order
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Build a lookup: dateStr -> schedule info
  const scheduleMap = useMemo(() => {
    const map = new Map<string, { available: boolean; slots: number; total: number; price: number; timeSlot: string }>();
    for (const s of schedules) {
      const existing = map.get(s.date);
      const avail = s.total_slots - s.booked_slots;
      if (!existing) {
        map.set(s.date, {
          available: avail > 0 && s.status === 'available',
          slots: avail,
          total: s.total_slots,
          price: s.price,
          timeSlot: s.time_slot,
        });
      } else {
        // Aggregate multiple time slots for same date
        existing.slots += avail;
        existing.total += s.total_slots;
        if (avail > 0 && s.status === 'available') existing.available = true;
      }
    }
    return map;
  }, [schedules]);

  const hasAnySchedule = schedules.length > 0;

  // Check if product is completely sold out (has schedules but none available)
  const isSoldOut = hasAnySchedule && ![...scheduleMap.values()].some((s) => s.available);

  // Calendar navigation limits: today to +2 months
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 2, 1), [today]);
  const canGoPrev = calendarMonth > new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoNext = calendarMonth < maxMonth;

  // Generate calendar grid for current month
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { date: string; day: number; available: boolean; hasSchedule: boolean; isPast: boolean; isToday: boolean; slots?: number; total?: number }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPast = dateObj < today;
      const isToday = dateObj.getTime() === today.getTime();
      const info = scheduleMap.get(dateStr);

      days.push({
        date: dateStr,
        day: d,
        available: !isPast && (!hasAnySchedule || (info?.available ?? false)),
        hasSchedule: !!info,
        isPast,
        isToday,
        slots: info?.slots,
        total: info?.total,
      });
    }

    return { days, leadingBlanks: firstDay };
  }, [calendarMonth, scheduleMap, today, hasAnySchedule]);

  // Time slots for selected date
  const selectedDateSlots = useMemo(() => {
    if (!selectedDate) return [];
    return schedules
      .filter((s) => s.date === selectedDate && s.status === 'available' && s.total_slots - s.booked_slots > 0)
      .map((s) => ({
        time: s.time_slot,
        slots: s.total_slots - s.booked_slots,
        total: s.total_slots,
        price: s.price,
      }));
  }, [selectedDate, schedules]);

  // --- Early return for loading (after all hooks) ---
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
      onBookNow(quantity, selectedDate);
    }
  };

  const handleAddToCart = () => {
    if (selectedDate && onAddToCart) {
      onAddToCart(product, selectedDate);
      setAddedToCart(true);
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
      addedTimerRef.current = setTimeout(() => setAddedToCart(false), 1500);
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

            {/* Sold Out Banner */}
            {isSoldOut && (
              <div className={styles.soldOutBanner}>
                {t('product.soldOut')}
              </div>
            )}

            {/* Calendar Date Selection */}
            <div className={styles.bookingSection}>
              <label className={styles.label}>{t('product.selectDate')}</label>

              {/* Calendar Header */}
              <div className={styles.calendarHeader}>
                <button
                  className={styles.calendarNav}
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  disabled={!canGoPrev}
                >
                  <ChevronLeft size={18} />
                </button>
                <span className={styles.calendarTitle}>
                  {calendarMonth.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' })}
                </span>
                <button
                  className={styles.calendarNav}
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  disabled={!canGoNext}
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className={styles.calendarWeekdays}>
                {(currentLang === 'zh'
                  ? ['日', '一', '二', '三', '四', '五', '六']
                  : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
                ).map((d) => (
                  <span key={d} className={styles.weekday}>{d}</span>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className={styles.calendarGrid}>
                {Array.from({ length: calendarDays.leadingBlanks }).map((_, i) => (
                  <div key={`blank-${i}`} className={styles.calendarBlank} />
                ))}
                {calendarDays.days.map((day) => (
                  <button
                    key={day.date}
                    className={`${styles.calendarDay} ${day.isPast ? styles.pastDay : ''} ${day.isToday ? styles.todayDay : ''} ${selectedDate === day.date ? styles.selectedDay : ''} ${day.available ? styles.availableDay : ''} ${day.hasSchedule && !day.available && !day.isPast ? styles.fullDay : ''}`}
                    onClick={() => day.available && setSelectedDate(day.date)}
                    disabled={!day.available}
                  >
                    <span className={styles.dayNumber}>{day.day}</span>
                    {day.hasSchedule && !day.isPast && (
                      <span className={`${styles.dayDot} ${day.available ? styles.dotAvailable : styles.dotFull}`} />
                    )}
                  </button>
                ))}
              </div>

              {/* Selected Date Time Slots */}
              {selectedDate && selectedDateSlots.length > 0 && (
                <div className={styles.timeSlots}>
                  <label className={styles.timeSlotsLabel}>
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                  </label>
                  {selectedDateSlots.map((slot, i) => (
                    <div key={i} className={styles.timeSlotItem}>
                      <span className={styles.timeSlotTime}>{slot.time || t('product.allDay', 'All Day')}</span>
                      <span className={styles.timeSlotSlots}>
                        {slot.slots}/{slot.total} {t('product.slotsLeft', 'slots')}
                      </span>
                      {slot.price > 0 && (
                        <span className={styles.timeSlotPrice}>
                          A${slot.price}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
                disabled={!selectedDate || isSoldOut}
                onClick={handleBook}
              >
                {isSoldOut ? t('product.soldOut') : t('product.buyNow')}
              </Button>
              <Button
                variant={addedToCart ? 'success' : 'outline'}
                size="lg"
                fullWidth
                disabled={!selectedDate || isSoldOut}
                onClick={handleAddToCart}
              >
                {addedToCart ? `${t('cart.added')} ✓` : t('product.addToCart')}
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
