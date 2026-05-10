import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SmartFAQ = lazy(() => import('../../components/AI/SmartFAQ/SmartFAQ'));
const FitCheck = lazy(() => import('../../components/AI/FitCheck/FitCheck'));
const ReviewSummary = lazy(() => import('../../components/AI/ReviewSummary/ReviewSummary'));
// REQ-20260510-0011 · 2A: 南澳 KB grounded 嵌入式 3 按钮（与上面的 FitCheck
// 共存：FitCheck 是 profile-based（adults/children），TourismTravelerSection
// 是 free-text + KB grounding，两者从不同角度覆盖访客判断需求）
const TourismTravelerSection = lazy(() => import('../../components/AI/TourismTravelerSection'));
import {
  Header,
  Footer,
  Button,
  Loading,
  GoogleMap,
} from '../../components/Common';
import type { Product } from '../../types';
import { productService, transformApiProduct } from '../../services/productService';
import type { ApiProductSchedule, ApiProductPackage } from '../../services/productService';
import { getLocalizedField } from '../../utils/getLocalizedField';
import styles from './ProductDetailPage.module.css';

/** Booking data passed to onBookNow */
export interface BookingData {
  quantity: number;
  selectedDate: string;
  packageId: number;
  packageName?: string;
  scheduleId?: number;
  timeSlot?: string;
  unitPrice: number;
}

export interface ProductDetailPageProps {
  language?: 'zh' | 'en';
  isLoggedIn?: boolean;
  userName?: string;
  cartCount?: number;
  productId?: string;
  loading?: boolean;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onBookNow?: (data: BookingData) => void;
  onAddToCart?: (product: Product, selectedDate?: string, selectedTime?: string, packageId?: number, scheduleId?: number) => void;
  /**
   * REQ-20260510-0001 F1: 预览模式
   *   - 禁用「立即预订」/「加入购物车」CTA（替换为灰按钮 Preview only）
   *   - 禁用 lazy 加载子组件（SmartFAQ / FitCheck / ReviewSummary）减少二次请求
   *   - 内部取语言字段时 strict=true，缺字段不 fallback（由组件层显 skeleton）
   */
  previewMode?: boolean;
  /**
   * REQ-20260510-0001 F1: 预览数据。优先于 productId fetch。
   * 用于 supplier/admin 编辑中的草稿走预览（避免公开 API 取不到草稿）。
   */
  previewData?: Product;
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
  previewMode = false,
  previewData,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = language || (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';
  const isZh = currentLang === 'zh';

  // Core state
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ApiProductSchedule[]>([]);
  const [apiPackages, setApiPackages] = useState<ApiProductPackage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Selection state
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

  // UI state
  const [addedToCart, setAddedToCart] = useState(false);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch product + schedules
  // REQ-20260510-0001 F1: previewData 优先，跳过 fetch 直接渲染当前 form 草稿
  useEffect(() => {
    if (previewData) {
      setProduct(previewData);
      setSchedules([]);
      setApiPackages([]);
      setLoading(false);
      return;
    }
    if (!productId) return;
    setLoading(true);
    const numId = Number(productId);
    Promise.all([
      productService.getById(numId).then((apiProduct) => {
        setProduct(transformApiProduct(apiProduct));
        const pkgs = apiProduct.packages || [];
        setApiPackages(pkgs);
        if (pkgs.length > 0) setSelectedPackageId(pkgs[0].id);
      }),
      productService.getSchedules(numId).then((s) => {
        setSchedules(s || []);
      }).catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId, previewData]);

  // Reset date & time when package changes
  useEffect(() => {
    setSelectedDate('');
    setSelectedScheduleId(null);
  }, [selectedPackageId]);

  // Reset time when date changes
  useEffect(() => {
    setSelectedScheduleId(null);
  }, [selectedDate]);

  // Calendar month state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Schedule map filtered by selected package
  const scheduleMap = useMemo(() => {
    const filtered = selectedPackageId
      ? schedules.filter((s) => s.package_id === selectedPackageId)
      : schedules;
    const map = new Map<string, { available: boolean; slots: number; total: number; price: number }>();
    for (const s of filtered) {
      // Normalize date: "2026-03-27T00:00:00+10:30" → "2026-03-27"
      const dateKey = s.date.length > 10 ? s.date.slice(0, 10) : s.date;
      const existing = map.get(dateKey);
      const avail = s.total_slots - s.booked_slots;
      if (!existing) {
        map.set(dateKey, {
          available: avail > 0 && s.status === 'available',
          slots: avail,
          total: s.total_slots,
          price: s.price,
        });
      } else {
        existing.slots += avail;
        existing.total += s.total_slots;
        if (avail > 0 && s.status === 'available') existing.available = true;
      }
    }
    return map;
  }, [schedules, selectedPackageId]);

  const hasScheduleForPackage = scheduleMap.size > 0;
  const isSoldOut = hasScheduleForPackage && ![...scheduleMap.values()].some((s) => s.available);

  // Calendar navigation limits
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 2, 1), [today]);
  const canGoPrev = calendarMonth > new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoNext = calendarMonth < maxMonth;

  // Calendar grid
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { date: string; day: number; available: boolean; hasSchedule: boolean; isPast: boolean; isToday: boolean; slots?: number; total?: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPast = dateObj < today;
      const isToday = dateObj.getTime() === today.getTime();
      const info = scheduleMap.get(dateStr);
      days.push({
        date: dateStr, day: d,
        available: !isPast && (!hasScheduleForPackage || (info?.available ?? false)),
        hasSchedule: !!info, isPast, isToday,
        slots: info?.slots, total: info?.total,
      });
    }
    return { days, leadingBlanks: firstDay };
  }, [calendarMonth, scheduleMap, today, hasScheduleForPackage]);

  // Time slots for selected date filtered by package
  const selectedDateSlots = useMemo(() => {
    if (!selectedDate) return [];
    return schedules
      .filter((s) =>
        (s.date.length > 10 ? s.date.slice(0, 10) : s.date) === selectedDate
        && (!selectedPackageId || s.package_id === selectedPackageId)
        && s.status === 'available'
        && s.total_slots - s.booked_slots > 0
      )
      .map((s) => ({
        id: s.id,
        time: s.time_slot,
        slots: s.total_slots - s.booked_slots,
        total: s.total_slots,
        price: s.price,
      }));
  }, [selectedDate, schedules, selectedPackageId]);

  // Auto-select if only 1 time slot
  useEffect(() => {
    if (selectedDateSlots.length === 1) {
      setSelectedScheduleId(selectedDateSlots[0].id);
    }
  }, [selectedDateSlots]);

  // Derived values
  const selectedPackage = apiPackages.find((p) => p.id === selectedPackageId);
  const selectedSlot = selectedDateSlots.find((s) => s.id === selectedScheduleId);
  const unitPrice = selectedSlot?.price || selectedPackage?.price || product?.price || 0;
  const totalPrice = unitPrice * quantity;
  const currencySymbol = product?.currency === 'CNY' ? '¥' : 'A$';

  // --- Early return for loading (after all hooks) ---
  const isLoading = loading || externalLoading || !product;
  if (isLoading) {
    // REQ-20260510-0001 F2: previewMode 下不渲染 Header/Footer，让父容器（双语预览页）控制 chrome
    if (previewMode) {
      return <div className={styles.loadingContainer}><Loading size="lg" /></div>;
    }
    return (
      <div className={styles.page}>
        <Header isLoggedIn={isLoggedIn} userName={userName} cartCount={cartCount}
          onLoginClick={onLoginClick} onRegisterClick={onRegisterClick} onNavClick={onNavClick} />
        <div className={styles.loadingContainer}><Loading size="lg" /></div>
        <Footer />
      </div>
    );
  }

  // REQ-20260510-0001 F1/F6: 统一用 getLocalizedField helper，previewMode 启用 strict
  // strict=false（C 端默认）保留现有 fallback 行为，零回归。
  const title = getLocalizedField({ zh: product.title, en: product.titleEn }, currentLang, { strict: previewMode }) ?? '';
  const location = getLocalizedField({ zh: product.location, en: product.locationEn }, currentLang, { strict: previewMode }) ?? '';
  const duration = getLocalizedField({ zh: product.duration, en: product.durationEn }, currentLang, { strict: previewMode }) ?? '';
  const meetingPoint = product.meetingPoint;

  const canBook = selectedDate && (selectedDateSlots.length === 0 || selectedScheduleId !== null);

  const handleBook = () => {
    if (!canBook || !onBookNow) return;
    onBookNow({
      quantity,
      selectedDate,
      packageId: selectedPackageId || 0,
      packageName: isZh ? selectedPackage?.name_zh : selectedPackage?.name_en,
      scheduleId: selectedScheduleId || undefined,
      timeSlot: selectedSlot?.time,
      unitPrice,
    });
  };

  const handleAddToCart = () => {
    if (selectedDate && onAddToCart) {
      onAddToCart(product, selectedDate, selectedSlot?.time, selectedPackageId || undefined, selectedScheduleId || undefined);
      setAddedToCart(true);
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
      addedTimerRef.current = setTimeout(() => setAddedToCart(false), 1500);
    }
  };

  return (
    <div className={styles.page}>
      {/* REQ-20260510-0001 F2: previewMode 下不渲染 Header/Footer，由父容器（双语预览页）提供 chrome */}
      {!previewMode && (
        <Header isLoggedIn={isLoggedIn} userName={userName} cartCount={cartCount}
          onLoginClick={onLoginClick} onRegisterClick={onRegisterClick} onNavClick={onNavClick} />
      )}

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Image Gallery */}
          <section className={styles.gallery}>
            <div className={styles.mainImage}>
              <img src={product.images[currentImageIndex]} alt={title} className={styles.image} />
              {product.originalPrice && (
                <span className={styles.discountBadge}>
                  {Math.round((1 - product.price / product.originalPrice) * 100)}% OFF
                </span>
              )}
            </div>
            <div className={styles.thumbnails}>
              {product.images.map((img, index) => (
                <button key={index}
                  className={`${styles.thumbnail} ${index === currentImageIndex ? styles.active : ''}`}
                  onClick={() => setCurrentImageIndex(index)}>
                  <img src={img} alt={`${title} ${index + 1}`} />
                </button>
              ))}
            </div>
          </section>

          {/* Content */}
          <div className={styles.content}>
            <section className={styles.productInfo}>
              <h1 className={styles.title}>{title}</h1>
              <div className={styles.meta}>
                <span className={styles.rating}>⭐ {product.rating.toFixed(1)}</span>
                <span className={styles.reviewCount}>({product.reviewCount} {t('product.reviews')})</span>
                <span className={styles.location}>📍 {location}</span>
              </div>
              <div className={styles.badges}>
                {product.instantConfirmation && <span className={styles.badge}>⚡ {t('product.instantConfirmation')}</span>}
                {product.freeCancellation && <span className={styles.badge}>✓ {t('product.freeCancellation')}</span>}
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

            {location && (
              <section className={styles.mapSection}>
                <h2 className={styles.sectionTitle}>{t('product.locationMap')}</h2>
                <GoogleMap address={product.locationEn || product.location} title={title} height={300} />
                {meetingPoint && meetingPoint !== location && (
                  <p className={styles.meetingPointNote}>📍 {t('product.meetingPoint')}: {meetingPoint}</p>
                )}
              </section>
            )}

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t('product.highlights')}</h2>
              <ul className={styles.highlightsList}>
                {product.highlights.map((item, index) => <li key={index}>✨ {item}</li>)}
              </ul>
            </section>

            <div className={styles.inclusionsGrid}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('product.inclusions')}</h2>
                <ul className={styles.list}>
                  {product.inclusions.map((item, index) => <li key={index} className={styles.included}>✓ {item}</li>)}
                </ul>
              </section>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('product.exclusions')}</h2>
                <ul className={styles.list}>
                  {product.exclusions.map((item, index) => <li key={index} className={styles.excluded}>✗ {item}</li>)}
                </ul>
              </section>
            </div>

            {/* ========== AI Enhanced Sections ========== */}
            {/* REQ-20260510-0001 F1: previewMode 下禁用 lazy 子组件，减少二次请求 + 避免预览时混入推荐位 */}
            {!previewMode && (
              <>
                <Suspense fallback={null}>
                  <SmartFAQ productId={Number(productId)} language={isZh ? 'zh' : 'en'} />
                </Suspense>

                {/* REQ-20260510-0011 · 2A: 南澳 KB grounded 嵌入按钮组 */}
                <Suspense fallback={null}>
                  <TourismTravelerSection productId={Number(productId)} />
                </Suspense>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <Suspense fallback={null}>
                    <FitCheck productId={Number(productId)} language={isZh ? 'zh' : 'en'} />
                  </Suspense>
                  <Suspense fallback={null}>
                    <ReviewSummary
                      productId={Number(productId)}
                      rating={product.rating}
                      reviewCount={product.reviewCount || 0}
                      language={isZh ? 'zh' : 'en'}
                    />
                  </Suspense>
                </div>
              </>
            )}
          </div>

          {/* ========== Booking Card ========== */}
          <aside className={styles.bookingCard}>
            {/* Price Header */}
            <div className={styles.priceSection}>
              <div className={styles.price}>
                <span className={styles.currency}>{currencySymbol}</span>
                <span className={styles.amount}>{unitPrice}</span>
                <span className={styles.suffix}>{t('product.perPerson')}</span>
              </div>
              {product.originalPrice && product.originalPrice > unitPrice && (
                <span className={styles.originalPrice}>
                  {t('product.originalPrice')} {currencySymbol}{product.originalPrice}
                </span>
              )}
            </div>

            {isSoldOut && <div className={styles.soldOutBanner}>{t('product.allDatesSoldOut')}</div>}

            {/* ① Package Selection */}
            {apiPackages.length > 0 && (
              <div className={styles.bookingSection}>
                <label className={styles.label}>{t('product.selectPackage')}</label>
                <div className={styles.packageList}>
                  {apiPackages.map((pkg) => {
                    const name = isZh ? pkg.name_zh : (pkg.name_en || pkg.name_zh);
                    const desc = isZh ? pkg.desc_zh : (pkg.desc_en || pkg.desc_zh);
                    const isSelected = pkg.id === selectedPackageId;
                    // REQ-20260509-0035: stock_total = -1 → 无限量；0 → 已售罄。
                    // REQ-20260511-0002: 警示阈值改读 pkg.low_stock_threshold（默认 5），
                    // 与 supplier/admin「剩余 ≤ N 时通知补货」字段一致；
                    // threshold = 0（supplier 已关闭预警）→ C 端也不显示「仅剩」徽章。
                    const total = pkg.stock_total;
                    const sold = pkg.stock_sold ?? 0;
                    const isLimited = typeof total === 'number' && total >= 0;
                    const remaining = isLimited ? Math.max(0, (total ?? 0) - sold) : Infinity;
                    const isSoldOut = isLimited && remaining === 0;
                    const threshold = pkg.low_stock_threshold ?? 5;
                    const showWarning = isLimited && remaining > 0 && threshold > 0 && remaining <= threshold;
                    return (
                      <button key={pkg.id}
                        className={`${styles.packageCard} ${isSelected ? styles.packageCardSelected : ''} ${isSoldOut ? styles.packageCardDisabled : ''}`}
                        onClick={() => !isSoldOut && setSelectedPackageId(pkg.id)}
                        disabled={isSoldOut}
                        aria-disabled={isSoldOut}>
                        <span className={styles.packageName}>{name}</span>
                        {desc && <span className={styles.packageDesc}>{desc}</span>}
                        <span className={styles.packagePrice}>{currencySymbol}{pkg.price}{t('product.perPerson')}</span>
                        {isSoldOut && (
                          <span className={styles.packageStockSoldOut}>{t('product.stock.soldOut', '已售罄')}</span>
                        )}
                        {showWarning && (
                          <span className={styles.packageStockWarning}>{t('product.stock.remaining', { count: remaining, defaultValue: '仅剩 {{count}} 份' })}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ② Calendar */}
            <div className={styles.bookingSection}>
              <label className={styles.label}>{t('product.selectDate')}</label>
              <div className={styles.calendarHeader}>
                <button className={styles.calendarNav}
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  disabled={!canGoPrev}><ChevronLeft size={18} /></button>
                <span className={styles.calendarTitle}>
                  {calendarMonth.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' })}
                </span>
                <button className={styles.calendarNav}
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  disabled={!canGoNext}><ChevronRight size={18} /></button>
              </div>
              <div className={styles.calendarWeekdays}>
                {(isZh ? ['日', '一', '二', '三', '四', '五', '六'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
                ).map((d) => <span key={d} className={styles.weekday}>{d}</span>)}
              </div>
              <div className={styles.calendarGrid}>
                {Array.from({ length: calendarDays.leadingBlanks }).map((_, i) => (
                  <div key={`blank-${i}`} className={styles.calendarBlank} />
                ))}
                {calendarDays.days.map((day) => {
                  const isLimited = day.hasSchedule && day.available && day.slots !== undefined && day.slots < 5;
                  const isDateSoldOut = day.hasSchedule && !day.available && !day.isPast;
                  const info = day.hasSchedule ? scheduleMap.get(day.date) : undefined;
                  return (
                    <button key={day.date}
                      className={`${styles.calendarDay} ${day.isPast ? styles.pastDay : ''} ${day.isToday ? styles.todayDay : ''} ${selectedDate === day.date ? styles.selectedDay : ''} ${day.available ? styles.availableDay : ''} ${isDateSoldOut ? styles.fullDay : ''}`}
                      onClick={() => day.available && setSelectedDate(day.date)}
                      disabled={!day.available}>
                      <span className={styles.dayNumber}>{day.day}</span>
                      {isDateSoldOut ? (
                        <span className={styles.daySoldOut}>{isZh ? '满' : 'Full'}</span>
                      ) : day.hasSchedule && !day.isPast && info ? (
                        <>
                          {info.price > 0 && (
                            <span className={styles.dayPrice}>{currencySymbol}{info.price}</span>
                          )}
                          <span className={`${styles.daySlots} ${isLimited ? styles.daySlotsLimited : styles.daySlotsAvailable}`}>
                            {isZh ? `余${day.slots}` : `${day.slots} left`}
                          </span>
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* ③ Time Slot Selection */}
              {selectedDate && selectedDateSlots.length > 0 && (
                <div className={styles.timeSlots}>
                  <label className={styles.timeSlotsLabel}>{t('product.selectTime')}</label>
                  {selectedDateSlots.map((slot) => {
                    const isSelected = slot.id === selectedScheduleId;
                    return (
                      <button key={slot.id}
                        className={`${styles.timeSlotItem} ${isSelected ? styles.timeSlotSelected : ''}`}
                        onClick={() => setSelectedScheduleId(slot.id)}>
                        <span className={styles.timeSlotTime}>{slot.time || t('product.allDay')}</span>
                        <span className={styles.timeSlotSlots}>
                          {isZh ? `余${slot.slots}位` : `${slot.slots} left`}
                        </span>
                        <span className={styles.timeSlotPrice}>{currencySymbol}{slot.price}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ④ Quantity */}
            <div className={styles.bookingSection}>
              <label className={styles.label}>{t('product.selectParticipants')}</label>
              <div className={styles.quantitySelector}>
                <span>{t('order.adults')}</span>
                <div className={styles.quantityControls}>
                  <button className={styles.quantityBtn} onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>−</button>
                  <span className={styles.quantityValue}>{quantity}</span>
                  <button className={styles.quantityBtn} onClick={() => setQuantity(Math.min(10, quantity + 1))} disabled={quantity >= 10}>+</button>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className={styles.totalSection}>
              <span className={styles.totalLabel}>{t('product.totalPrice')}</span>
              <span className={styles.totalPrice}>{currencySymbol}{totalPrice}</span>
            </div>

            {/* Actions */}
            {/* REQ-20260510-0001 F1: previewMode 下 CTA 替换为灰按钮，明确"仅预览"状态 */}
            <div className={styles.actions}>
              {previewMode ? (
                <>
                  <Button variant="outline" size="lg" fullWidth disabled>
                    {t('preview.previewOnly')} · {t('product.buyNow')}
                  </Button>
                  <Button variant="outline" size="lg" fullWidth disabled>
                    {t('preview.previewOnly')} · {t('product.addToCart')}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" size="lg" fullWidth disabled={!canBook} onClick={handleBook}>
                    {t('product.buyNow')}
                  </Button>
                  <Button variant={addedToCart ? 'success' : 'outline'} size="lg" fullWidth
                    disabled={!selectedDate} onClick={handleAddToCart}>
                    {addedToCart ? `${t('cart.added')} ✓` : t('product.addToCart')}
                  </Button>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* REQ-20260510-0001 F2: previewMode 下不渲染 Footer */}
      {!previewMode && <Footer />}
    </div>
  );
};

export default ProductDetailPage;
