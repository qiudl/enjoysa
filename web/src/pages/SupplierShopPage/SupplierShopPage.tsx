import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Star, Phone, Package } from 'lucide-react';
import { Header, Footer } from '../../components/Common';
import { ProductCard } from '../../components/Product/ProductCard/ProductCard';
import type { Product } from '../../types';
import styles from './SupplierShopPage.module.css';

// Mock supplier data
const mockSupplier = {
  id: '1',
  name: '阿德莱德探险之旅',
  nameEn: 'Adelaide Adventure Tours',
  type: 'travel_agency',
  rating: 4.7,
  reviewCount: 369,
  productCount: 12,
  location: '阿德莱德，南澳大利亚',
  locationEn: 'Adelaide, South Australia',
  phone: '08 **** 5678',
  hours: '09:00 - 18:00',
  description: '专注南澳旅游体验，提供优质的一日游和多日游服务。',
  descriptionEn: 'Specializing in South Australia tourism, offering quality day tours and multi-day tour services.',
};

const mockProducts: Product[] = [
  {
    id: 'sp1', title: '袋鼠岛一日游', titleEn: 'Kangaroo Island Day Tour',
    description: '', images: ['/images/products/kangaroo-island.jpg'],
    price: 289, currency: 'AUD', rating: 4.8, reviewCount: 156,
    location: '袋鼠岛', locationEn: 'Kangaroo Island',
    duration: '10小时', durationEn: '10 hours',
    highlights: [], inclusions: [], exclusions: [],
    category: { id: '1', name: '一日游', nameEn: 'Day Tours' },
    destination: { id: '1', name: '袋鼠岛', nameEn: 'Kangaroo Island', region: '南澳', regionEn: 'SA' },
    tags: ['hot', 'nature'], availability: 'available',
    instantConfirmation: true, freeCancellation: true,
    supplierId: '1', createdAt: '', updatedAt: '',
  },
  {
    id: 'sp2', title: '巴罗莎谷酒庄之旅', titleEn: 'Barossa Valley Winery Tour',
    description: '', images: ['/images/products/barossa.jpg'],
    price: 199, currency: 'AUD', rating: 4.6, reviewCount: 98,
    location: '巴罗莎谷', locationEn: 'Barossa Valley',
    duration: '8小时', durationEn: '8 hours',
    highlights: [], inclusions: [], exclusions: [],
    category: { id: '2', name: '美食', nameEn: 'Food & Wine' },
    destination: { id: '2', name: '巴罗莎谷', nameEn: 'Barossa Valley', region: '南澳', regionEn: 'SA' },
    tags: ['food', 'recommended'], availability: 'available',
    instantConfirmation: true, freeCancellation: true,
    supplierId: '1', createdAt: '', updatedAt: '',
  },
  {
    id: 'sp3', title: '阿德莱德城市观光', titleEn: 'Adelaide City Sightseeing',
    description: '', images: ['/images/products/adelaide-city.jpg'],
    price: 129, currency: 'AUD', rating: 4.5, reviewCount: 72,
    location: '阿德莱德', locationEn: 'Adelaide',
    duration: '4小时', durationEn: '4 hours',
    highlights: [], inclusions: [], exclusions: [],
    category: { id: '3', name: '城市游', nameEn: 'City Tours' },
    destination: { id: '3', name: '阿德莱德', nameEn: 'Adelaide', region: '南澳', regionEn: 'SA' },
    tags: ['culture'], availability: 'available',
    instantConfirmation: true, freeCancellation: false,
    supplierId: '1', createdAt: '', updatedAt: '',
  },
  {
    id: 'sp4', title: '弗林德斯山脉探险', titleEn: 'Flinders Ranges Adventure',
    description: '', images: ['/images/products/flinders.jpg'],
    price: 459, currency: 'AUD', rating: 4.9, reviewCount: 43,
    location: '弗林德斯山脉', locationEn: 'Flinders Ranges',
    duration: '2天', durationEn: '2 days',
    highlights: [], inclusions: [], exclusions: [],
    category: { id: '4', name: '冒险', nameEn: 'Adventure' },
    destination: { id: '4', name: '弗林德斯山脉', nameEn: 'Flinders Ranges', region: '南澳', regionEn: 'SA' },
    tags: ['adventure', 'nature'], availability: 'limited',
    instantConfirmation: false, freeCancellation: true,
    supplierId: '1', createdAt: '', updatedAt: '',
  },
];

const mockReviews = [
  { id: '1', user: '张先生', rating: 5, date: '2026-03-15', content: '非常棒的体验！导游很专业，行程安排合理。强烈推荐袋鼠岛一日游！', contentEn: 'Wonderful experience! Professional guide and well-organized itinerary. Highly recommend the Kangaroo Island Day Tour!', product: '袋鼠岛一日游', productEn: 'Kangaroo Island Day Tour' },
  { id: '2', user: 'Sarah L.', rating: 4, date: '2026-03-12', content: '酒庄之旅很享受，品尝了很多好酒。唯一不足是时间有点赶。', contentEn: 'Enjoyed the winery tour a lot. Tasted many great wines. Only downside was the tight schedule.', product: '巴罗莎谷酒庄之旅', productEn: 'Barossa Valley Winery Tour' },
  { id: '3', user: '李女士', rating: 5, date: '2026-03-08', content: '城市观光非常适合初次来阿德莱德的游客，导游中英文讲解。', contentEn: 'City sightseeing is perfect for first-time visitors to Adelaide. Guide provides bilingual commentary.', product: '阿德莱德城市观光', productEn: 'Adelaide City Sightseeing' },
];

export interface SupplierShopPageProps {
  supplierId?: string;
  cartCount?: number;
  onProductClick?: (product: Product) => void;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onSearch?: (keyword: string) => void;
}

export const SupplierShopPage: React.FC<SupplierShopPageProps> = ({
  cartCount = 0,
  onProductClick,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onSearch,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const name = isZh ? mockSupplier.name : mockSupplier.nameEn;
  const location = isZh ? mockSupplier.location : mockSupplier.locationEn;

  return (
    <div className={styles.page}>
      <Header
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
        onSearch={onSearch}
      />

      <main className={styles.main}>
        {/* Shop Banner */}
        <section className={styles.banner}>
          <div className={styles.bannerContent}>
            <div className={styles.shopLogo}>{name.charAt(0)}</div>
            <h1 className={styles.shopName}>{name}</h1>
            <span className={styles.shopType}>{t(`supplier.types.${mockSupplier.type}`)}</span>

            <div className={styles.shopStats}>
              <div className={styles.stat}>
                <div className={styles.statValue}>
                  <Star size={18} fill="#facc15" color="#facc15" />
                  {mockSupplier.rating}
                </div>
                <div className={styles.statLabel}>{t('shop.rating')}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{mockSupplier.productCount}</div>
                <div className={styles.statLabel}>{t('shop.products')}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{mockSupplier.reviewCount}</div>
                <div className={styles.statLabel}>{t('shop.reviews')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Info */}
        <section className={styles.infoSection}>
          <div className={styles.infoCard}>
            <div className={styles.infoItem}>
              <MapPin size={16} />
              <span>{location}</span>
            </div>
            <div className={styles.infoItem}>
              <Clock size={16} />
              <span>{mockSupplier.hours}</span>
            </div>
            <div className={styles.infoItem}>
              <Phone size={16} />
              <span>{mockSupplier.phone}</span>
            </div>
            <div className={styles.infoItem}>
              <Package size={16} />
              <span>{isZh ? mockSupplier.description : mockSupplier.descriptionEn}</span>
            </div>
          </div>
        </section>

        {/* Products */}
        <section className={styles.productsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('shop.allProducts')}</h2>
            <span className={styles.productCount}>
              {mockProducts.length} {t('shop.items')}
            </span>
          </div>
          <div className={styles.productGrid}>
            {mockProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                language={isZh ? 'zh' : 'en'}
                onClick={() => onProductClick?.(product)}
              />
            ))}
          </div>
        </section>

        {/* Reviews */}
        <section className={styles.reviewsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('shop.recentReviews')}</h2>
          </div>
          <div className={styles.reviewList}>
            {mockReviews.map((review) => (
              <div key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  <div className={styles.reviewAvatar}>{review.user.charAt(0)}</div>
                  <div>
                    <div className={styles.reviewAuthor}>{review.user}</div>
                    <div className={styles.reviewDate}>{review.date}</div>
                  </div>
                </div>
                <div className={styles.reviewStars}>
                  {Array.from({ length: review.rating }, (_, i) => (
                    <Star key={i} size={14} fill="#facc15" />
                  ))}
                </div>
                <div className={styles.reviewContent}>
                  {isZh ? review.content : review.contentEn}
                </div>
                <div className={styles.reviewProduct}>
                  {isZh ? review.product : review.productEn}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer onNavClick={onNavClick} />
    </div>
  );
};

export default SupplierShopPage;
