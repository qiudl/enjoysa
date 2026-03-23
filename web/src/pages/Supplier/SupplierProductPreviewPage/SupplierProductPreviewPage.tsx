import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Edit,
  Info,
  Image,
  ChevronLeft,
  ChevronRight,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import styles from './SupplierProductPreviewPage.module.css';

/* ------------------------------------------------------------------ */
/*  Data model                                                         */
/* ------------------------------------------------------------------ */

interface ScheduleItem {
  time: string;
  activity: string;
  activityEn: string;
}

interface ProductPreview {
  id: string;
  name: string;
  nameEn: string;
  images: string[];
  rating: number;
  reviewCount: number;
  price: number;
  currency: string;
  duration: string;
  durationEn: string;
  description: string;
  descriptionEn: string;
  highlights: string[];
  highlightsEn: string[];
  includes: string[];
  includesEn: string[];
  excludes: string[];
  excludesEn: string[];
  schedule: ScheduleItem[];
  notices: string[];
  noticesEn: string[];
  availableDates: string[];
}

/* ------------------------------------------------------------------ */
/*  Helper: generate the next N days as YYYY-MM-DD strings             */
/* ------------------------------------------------------------------ */

function generateNextDays(count: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const mockProduct: ProductPreview = {
  id: '1',
  name: '袋鼠岛一日游',
  nameEn: 'Kangaroo Island Day Tour',
  images: ['', '', '', ''],
  rating: 4.8,
  reviewCount: 126,
  price: 199,
  currency: 'AUD',
  duration: '约10小时',
  durationEn: 'Approx. 10 hours',
  description:
    '探索南澳大利亚最著名的自然奇观——袋鼠岛。在这趟精彩的一日游中，您将近距离接触澳大利亚独有的野生动物，欣赏壮丽的海岸线风光，品尝当地美食，并深入了解岛上丰富的自然与人文历史。专业中英文导游全程陪同，为您带来难忘的旅行体验。',
  descriptionEn:
    'Explore Kangaroo Island, South Australia\'s most iconic natural wonder. On this unforgettable day tour, you will encounter Australia\'s unique wildlife up close, marvel at stunning coastal scenery, sample local delicacies, and discover the island\'s rich natural and cultural heritage. A professional bilingual guide accompanies you throughout the journey.',
  highlights: [
    '近距离接触野生海豹、袋鼠和考拉',
    '参观弗林德斯·蔡斯国家公园的神奇岩石',
    '品尝袋鼠岛本地蜂蜜和有机农产品',
    '欣赏南大洋壮丽的海岸线日落',
    '专业中英双语导游全程讲解',
  ],
  highlightsEn: [
    'Get up close with wild seals, kangaroos, and koalas',
    'Visit the Remarkable Rocks at Flinders Chase National Park',
    'Taste local Kangaroo Island honey and organic produce',
    'Enjoy stunning Southern Ocean coastal sunset views',
    'Professional bilingual guide throughout the tour',
  ],
  includes: [
    '阿德莱德市区酒店接送',
    '渡轮往返船票',
    '国家公园门票',
    '午餐（含素食选项）',
  ],
  includesEn: [
    'Adelaide CBD hotel pickup and drop-off',
    'Return ferry tickets',
    'National park entry fees',
    'Lunch (vegetarian option available)',
  ],
  excludes: [
    '旅行保险',
    '个人消费及小费',
  ],
  excludesEn: [
    'Travel insurance',
    'Personal expenses and gratuities',
  ],
  schedule: [
    { time: '06:30', activity: '阿德莱德市区酒店接客', activityEn: 'Hotel pickup from Adelaide CBD' },
    { time: '08:00', activity: '乘坐渡轮前往袋鼠岛', activityEn: 'Ferry departure to Kangaroo Island' },
    { time: '10:00', activity: '参观海豹湾保护区，近距离观察野生海豹', activityEn: 'Visit Seal Bay Conservation Park to observe wild sea lions' },
    { time: '12:30', activity: '袋鼠岛本地餐厅午餐', activityEn: 'Lunch at a local Kangaroo Island restaurant' },
    { time: '14:00', activity: '探索弗林德斯·蔡斯国家公园（神奇岩石、旗舰拱门）', activityEn: 'Explore Flinders Chase National Park (Remarkable Rocks, Admirals Arch)' },
  ],
  notices: [
    '请穿着舒适的步行鞋和防风外套',
    '晕船旅客建议提前服用晕船药',
    '行程可能因天气原因调整，届时会提前通知',
  ],
  noticesEn: [
    'Please wear comfortable walking shoes and a windproof jacket',
    'Guests prone to seasickness are advised to take medication in advance',
    'Itinerary may be adjusted due to weather conditions; advance notice will be given',
  ],
  availableDates: generateNextDays(7),
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface SupplierProductPreviewPageProps {
  productId?: string;
  onNavigate?: (path: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const SupplierProductPreviewPage: React.FC<SupplierProductPreviewPageProps> = ({
  productId,
  onNavigate,
}) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const product = mockProduct;

  /* Carousel state */
  const [currentImage, setCurrentImage] = useState(0);
  const imageCount = product.images.length;

  const prevImage = () =>
    setCurrentImage((prev) => (prev - 1 + imageCount) % imageCount);
  const nextImage = () =>
    setCurrentImage((prev) => (prev + 1) % imageCount);

  /* Date selector state */
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  /* Localized helpers */
  const productName = isEn ? product.nameEn : product.name;
  const description = isEn ? product.descriptionEn : product.description;
  const highlights = isEn ? product.highlightsEn : product.highlights;
  const includes = isEn ? product.includesEn : product.includes;
  const excludes = isEn ? product.excludesEn : product.excludes;
  const notices = isEn ? product.noticesEn : product.notices;
  const duration = isEn ? product.durationEn : product.duration;

  /* Format date for display */
  const formatDate = useMemo(() => {
    return (dateStr: string) => {
      const d = new Date(dateStr);
      const weekdays = isEn
        ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        : ['日', '一', '二', '三', '四', '五', '六'];
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const weekday = weekdays[d.getDay()];
      return { month, day, weekday };
    };
  }, [isEn]);

  /* Stars rendering */
  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.3;
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={18}
        fill={i < full || (i === full && hasHalf) ? '#f59e0b' : 'none'}
        stroke={i < full || (i === full && hasHalf) ? '#f59e0b' : '#d1d5db'}
      />
    ));
  };

  return (
    <div className={styles.container}>
      {/* Preview Banner */}
      <div className={styles.previewBanner}>
        <Info size={18} />
        <span>
          {t('supplier.preview.title')} ({t('supplier.preview.customerView')})
        </span>
      </div>

      {/* Header: back + edit */}
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => onNavigate?.('/supplier/products')}
        >
          <ArrowLeft size={18} />
          <span>{t('common.back')}</span>
        </button>
        <button
          className={styles.editBtn}
          onClick={() => onNavigate?.(`/supplier/products/${productId}/edit`)}
        >
          <Edit size={16} />
          <span>{t('supplier.preview.editProduct')}</span>
        </button>
      </div>

      {/* Image Carousel */}
      <div className={styles.carousel}>
        <div className={styles.carouselMain}>
          <Image size={48} strokeWidth={1.2} />
          <span className={styles.carouselPlaceholderText}>
            {t('supplier.preview.imagePlaceholder')} {currentImage + 1}/{imageCount}
          </span>
          <button
            className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`}
            onClick={prevImage}
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            className={`${styles.carouselArrow} ${styles.carouselArrowRight}`}
            onClick={nextImage}
            aria-label="Next image"
          >
            <ChevronRight size={24} />
          </button>
        </div>
        <div className={styles.thumbnails}>
          {product.images.map((_, idx) => (
            <button
              key={idx}
              className={`${styles.thumbnail} ${idx === currentImage ? styles.thumbnailActive : ''}`}
              onClick={() => setCurrentImage(idx)}
              aria-label={`Image ${idx + 1}`}
            >
              <Image size={16} strokeWidth={1.2} />
            </button>
          ))}
        </div>
      </div>

      {/* Product Info */}
      <div className={styles.productInfo}>
        <h1 className={styles.productName}>{productName}</h1>
        <div className={styles.rating}>
          {renderStars(product.rating)}
          <span className={styles.ratingValue}>{product.rating}</span>
          <span className={styles.reviewCount}>
            ({product.reviewCount} {t('supplier.preview.rating')})
          </span>
        </div>
        <div className={styles.priceRow}>
          <span className={styles.price}>
            {product.currency} ${product.price}
          </span>
          <span className={styles.perPerson}>/ {t('supplier.preview.perPerson')}</span>
        </div>
        <span className={styles.durationBadge}>
          <Clock size={14} />
          {duration}
        </span>
      </div>

      {/* Date Selector */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('supplier.preview.selectDate')}</h2>
        <div className={styles.dateSelector}>
          {product.availableDates.map((dateStr) => {
            const { month, day, weekday } = formatDate(dateStr);
            const isActive = selectedDate === dateStr;
            return (
              <button
                key={dateStr}
                className={`${styles.dateBtn} ${isActive ? styles.dateBtnActive : ''}`}
                onClick={() => setSelectedDate(dateStr)}
              >
                <span className={styles.dateWeekday}>{weekday}</span>
                <span className={styles.dateDay}>{day}</span>
                <span className={styles.dateMonth}>{month}{isEn ? '' : '月'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Highlights */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('supplier.preview.highlights')}</h2>
        <ul className={styles.highlightList}>
          {highlights.map((item, idx) => (
            <li key={idx} className={styles.highlightItem}>
              <Star size={16} fill="#f59e0b" stroke="#f59e0b" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Description */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('supplier.preview.description')}</h2>
        <p className={styles.descriptionText}>{description}</p>
      </div>

      {/* Schedule */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('supplier.preview.schedule')}</h2>
        <div className={styles.scheduleList}>
          {product.schedule.map((item, idx) => (
            <div key={idx} className={styles.scheduleItem}>
              <div className={styles.scheduleTimeline}>
                <span className={styles.scheduleDot} />
                {idx < product.schedule.length - 1 && (
                  <span className={styles.scheduleLine} />
                )}
              </div>
              <div className={styles.scheduleContent}>
                <span className={styles.scheduleTime}>{item.time}</span>
                <span className={styles.scheduleActivity}>
                  {isEn ? item.activityEn : item.activity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Includes / Excludes */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('supplier.preview.includes')}</h2>
        <ul className={styles.checkList}>
          {includes.map((item, idx) => (
            <li key={idx} className={styles.includeItem}>
              <CheckCircle size={18} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('supplier.preview.excludes')}</h2>
        <ul className={styles.checkList}>
          {excludes.map((item, idx) => (
            <li key={idx} className={styles.excludeItem}>
              <XCircle size={18} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Notices */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('supplier.preview.notices')}</h2>
        <ul className={styles.noticeList}>
          {notices.map((item, idx) => (
            <li key={idx} className={styles.noticeItem}>
              <AlertTriangle size={18} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SupplierProductPreviewPage;
