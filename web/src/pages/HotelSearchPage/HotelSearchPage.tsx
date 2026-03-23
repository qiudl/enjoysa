import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { Header, Footer, Pagination } from '../../components/Common';
import { hotelService, type HotelFilter, type HotelMetadata } from '../../services/hotelService';
import type { ApiProduct } from '../../services/productService';
import { regionService } from '../../services/regionService';
import styles from './HotelSearchPage.module.css';

export interface HotelSearchPageProps {
  cartCount?: number;
  initialKeyword?: string;
  initialRegionId?: number;
  onHotelClick?: (hotelId: number) => void;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
}

interface RegionOption {
  id: number;
  name: string;
  nameEn: string;
}

const STAR_OPTIONS = [5, 4, 3, 2];
const FACILITY_OPTIONS = [
  { key: 'wifi', zh: 'WiFi', en: 'WiFi' },
  { key: 'pool', zh: '游泳池', en: 'Pool' },
  { key: 'parking', zh: '停车场', en: 'Parking' },
  { key: 'breakfast', zh: '含早餐', en: 'Breakfast' },
  { key: 'gym', zh: '健身房', en: 'Gym' },
  { key: 'restaurant', zh: '餐厅', en: 'Restaurant' },
  { key: 'spa', zh: '水疗', en: 'Spa' },
  { key: 'bar', zh: '酒吧', en: 'Bar' },
];
const ACCOMMODATION_OPTIONS = [
  { key: 'hotel', zh: '酒店', en: 'Hotel' },
  { key: 'resort', zh: '度假村', en: 'Resort' },
  { key: 'boutique', zh: '精品酒店', en: 'Boutique' },
  { key: 'lodge', zh: '旅舍', en: 'Lodge' },
  { key: 'motel', zh: '汽车旅馆', en: 'Motel' },
  { key: 'hostel', zh: '青旅', en: 'Hostel' },
];

function getMetadata(hotel: ApiProduct): HotelMetadata | null {
  if (!hotel.metadata) return null;
  if (typeof hotel.metadata === 'string') {
    try { return JSON.parse(hotel.metadata); } catch { return null; }
  }
  return hotel.metadata as unknown as HotelMetadata;
}

export const HotelSearchPage: React.FC<HotelSearchPageProps> = ({
  cartCount = 0,
  initialKeyword = '',
  initialRegionId,
  onHotelClick,
  onLoginClick,
  onRegisterClick,
  onNavClick,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');

  // Search state
  const [keyword, setKeyword] = useState(initialKeyword);
  const [regionId, setRegionId] = useState<number | undefined>(initialRegionId);
  const [sortBy, setSortBy] = useState<HotelFilter['sort_by']>('recommend');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Filter state
  const [starRatings, setStarRatings] = useState<number[]>([]);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [accommodationTypes, setAccommodationTypes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Data state
  const [hotels, setHotels] = useState<ApiProduct[]>([]);
  const [totalHotels, setTotalHotels] = useState(0);
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<RegionOption[]>([]);

  // Fetch regions
  useEffect(() => {
    regionService.getAll().then((apiRegions) => {
      setRegions(apiRegions.map((r) => ({ id: Number(r.id), name: r.name, nameEn: r.nameEn || '' })));
    }).catch(() => {});
  }, []);

  // Fetch hotels
  const fetchHotels = useCallback(async () => {
    setLoading(true);
    try {
      const filter: HotelFilter = {
        page: currentPage,
        page_size: pageSize,
        sort_by: sortBy,
      };
      if (keyword) filter.keyword = keyword;
      if (regionId) filter.region_id = regionId;
      if (starRatings.length > 0) filter.star_rating = starRatings.join(',');
      if (facilities.length > 0) filter.facilities = facilities.join(',');
      if (accommodationTypes.length > 0) filter.accommodation_type = accommodationTypes.join(',');
      if (minPrice) filter.min_price = Number(minPrice);
      if (maxPrice) filter.max_price = Number(maxPrice);

      const result = await hotelService.search(filter);
      setHotels(result.items || []);
      setTotalHotels(result.total || 0);
    } catch {
      setHotels([]);
      setTotalHotels(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, keyword, regionId, sortBy, starRatings, facilities, accommodationTypes, minPrice, maxPrice]);

  useEffect(() => {
    fetchHotels();
  }, [fetchHotels]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchHotels();
  };

  const toggleStar = (star: number) => {
    setStarRatings((prev) =>
      prev.includes(star) ? prev.filter((s) => s !== star) : [...prev, star]
    );
    setCurrentPage(1);
  };

  const toggleFacility = (key: string) => {
    setFacilities((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
    setCurrentPage(1);
  };

  const toggleAccommodation = (key: string) => {
    setAccommodationTypes((prev) =>
      prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]
    );
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setStarRatings([]);
    setFacilities([]);
    setAccommodationTypes([]);
    setMinPrice('');
    setMaxPrice('');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderStars = (count: number) => '★'.repeat(count);

  const getFacilityLabel = (key: string) => {
    const opt = FACILITY_OPTIONS.find((f) => f.key === key);
    return opt ? (isZh ? opt.zh : opt.en) : key;
  };

  const renderHotelCard = (hotel: ApiProduct) => {
    const meta = getMetadata(hotel);
    const cover = hotel.images?.find((img) => img.is_cover) || hotel.images?.[0];

    return (
      <div
        key={hotel.id}
        className={styles.hotelCard}
        onClick={() => onHotelClick?.(hotel.id)}
      >
        <div className={styles.hotelImage}>
          {cover && (
            <img
              src={cover.url}
              alt={isZh ? hotel.name_zh : hotel.name_en}
              loading="lazy"
            />
          )}
          {meta && (
            <span className={styles.starBadge}>
              {renderStars(meta.star_rating)}
            </span>
          )}
        </div>
        <div className={styles.hotelInfo}>
          <h3 className={styles.hotelName}>
            {isZh ? hotel.name_zh : hotel.name_en}
          </h3>
          <div className={styles.hotelLocation}>
            <MapPin size={14} />
            {isZh ? hotel.address_zh : hotel.address_en}
            {meta && meta.distance_to_center > 0 && (
              <span> &middot; {t('hotel.distanceToCenter', { km: meta.distance_to_center })}</span>
            )}
          </div>
          {hotel.rating > 0 && (
            <div className={styles.hotelRating}>
              <span className={styles.ratingScore}>{hotel.rating.toFixed(1)}</span>
              <span className={styles.ratingText}>
                {hotel.review_count} {t('hotel.reviews')}
              </span>
            </div>
          )}
          <p className={styles.hotelSummary}>
            {isZh ? hotel.summary_zh : hotel.summary_en}
          </p>
          {meta && meta.facilities.length > 0 && (
            <div className={styles.hotelFacilities}>
              {meta.facilities.slice(0, 5).map((f) => (
                <span key={f} className={styles.facilityTag}>
                  {getFacilityLabel(f)}
                </span>
              ))}
              {meta.facilities.length > 5 && (
                <span className={styles.facilityTag}>+{meta.facilities.length - 5}</span>
              )}
            </div>
          )}
          <div className={styles.hotelPrice}>
            <span className={styles.priceLabel}>{t('hotel.priceFrom')} </span>
            <span className={styles.priceCurrency}>{hotel.currency} </span>
            <span className={styles.priceValue}>{hotel.price_from}</span>
            <span className={styles.priceUnit}> /{t('hotel.perNight')}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderSkeleton = () => (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonImage} />
      <div className={styles.skeletonContent}>
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <Header
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
      />

      {/* Search Panel */}
      <div className={styles.searchPanel}>
        <div className={styles.searchPanelInner}>
          <h1 className={styles.searchPanelTitle}>{t('hotel.searchTitle')}</h1>
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <div className={styles.searchField}>
              <label>{t('hotel.destination')}</label>
              <select
                value={regionId || ''}
                onChange={(e) => { setRegionId(e.target.value ? Number(e.target.value) : undefined); setCurrentPage(1); }}
              >
                <option value="">{t('hotel.allRegions')}</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {isZh ? r.name : r.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.searchField}>
              <label>{t('hotel.keyword')}</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={t('hotel.keywordPlaceholder')}
              />
            </div>
            <button type="submit" className={styles.searchBtn}>
              {t('hotel.search')}
            </button>
          </form>
        </div>
      </div>

      <div className={styles.mainContent}>
        {/* Sidebar Filters */}
        <aside className={styles.sidebar}>
          {/* Price Range */}
          <div className={styles.filterSection}>
            <h4 className={styles.filterTitle}>{t('hotel.priceRange')}</h4>
            <div className={styles.priceInputs}>
              <input
                type="number"
                className={styles.priceInput}
                placeholder={t('hotel.minPrice')}
                value={minPrice}
                onChange={(e) => { setMinPrice(e.target.value); setCurrentPage(1); }}
              />
              <span className={styles.priceSeparator}>-</span>
              <input
                type="number"
                className={styles.priceInput}
                placeholder={t('hotel.maxPrice')}
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          {/* Star Rating */}
          <div className={styles.filterSection}>
            <h4 className={styles.filterTitle}>{t('hotel.starRating')}</h4>
            <div className={styles.filterGroup}>
              {STAR_OPTIONS.map((star) => (
                <label key={star} className={styles.filterCheckbox}>
                  <input
                    type="checkbox"
                    checked={starRatings.includes(star)}
                    onChange={() => toggleStar(star)}
                  />
                  {renderStars(star)} {star}{t('hotel.star')}
                </label>
              ))}
            </div>
          </div>

          {/* Accommodation Type */}
          <div className={styles.filterSection}>
            <h4 className={styles.filterTitle}>{t('hotel.accommodationType')}</h4>
            <div className={styles.filterGroup}>
              {ACCOMMODATION_OPTIONS.map((opt) => (
                <label key={opt.key} className={styles.filterCheckbox}>
                  <input
                    type="checkbox"
                    checked={accommodationTypes.includes(opt.key)}
                    onChange={() => toggleAccommodation(opt.key)}
                  />
                  {isZh ? opt.zh : opt.en}
                </label>
              ))}
            </div>
          </div>

          {/* Facilities */}
          <div className={styles.filterSection}>
            <h4 className={styles.filterTitle}>{t('hotel.facilities')}</h4>
            <div className={styles.filterGroup}>
              {FACILITY_OPTIONS.map((opt) => (
                <label key={opt.key} className={styles.filterCheckbox}>
                  <input
                    type="checkbox"
                    checked={facilities.includes(opt.key)}
                    onChange={() => toggleFacility(opt.key)}
                  />
                  {isZh ? opt.zh : opt.en}
                </label>
              ))}
            </div>
          </div>

          <button className={styles.clearFilters} onClick={clearFilters}>
            {t('hotel.clearFilters')}
          </button>
        </aside>

        {/* Results */}
        <main className={styles.resultsSection}>
          <div className={styles.resultsHeader}>
            <div className={styles.resultsInfo}>
              <h2 className={styles.resultsTitle}>{t('hotel.results')}</h2>
              <span className={styles.resultsCount}>
                {totalHotels} {t('hotel.hotelsFound')}
              </span>
            </div>
            <div className={styles.sortControls}>
              <label className={styles.sortLabel}>{t('hotel.sortBy')}</label>
              <select
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as HotelFilter['sort_by']); setCurrentPage(1); }}
              >
                <option value="recommend">{t('hotel.sortOptions.recommend')}</option>
                <option value="price_asc">{t('hotel.sortOptions.priceLow')}</option>
                <option value="price_desc">{t('hotel.sortOptions.priceHigh')}</option>
                <option value="rating">{t('hotel.sortOptions.rating')}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className={styles.hotelList}>
              {Array.from({ length: 3 }).map((_, i) => (
                <React.Fragment key={i}>{renderSkeleton()}</React.Fragment>
              ))}
            </div>
          ) : hotels.length > 0 ? (
            <>
              <div className={styles.hotelList}>
                {hotels.map(renderHotelCard)}
              </div>
              <div className={styles.pagination}>
                <Pagination
                  current={currentPage}
                  total={totalHotels}
                  pageSize={pageSize}
                  showTotal
                  language={isZh ? 'zh' : 'en'}
                  onChange={handlePageChange}
                />
              </div>
            </>
          ) : (
            <div className={styles.noResults}>
              <span className={styles.noResultsIcon}>🏨</span>
              <h3>{t('hotel.noResults')}</h3>
              <p>{t('hotel.tryOther')}</p>
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default HotelSearchPage;
