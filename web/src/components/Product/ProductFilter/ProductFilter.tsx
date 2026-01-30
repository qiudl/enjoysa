import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Filter, ChevronDown, X, DollarSign, Star, MapPin } from 'lucide-react';
import styles from './ProductFilter.module.css';
import type { ProductFilter as FilterType, ProductCategory, Destination, ProductTag } from '../../../types';

export interface ProductFilterProps {
  /** 当前筛选条件 */
  filters?: Partial<FilterType>;
  /** 可用分类 */
  categories?: ProductCategory[];
  /** 可用目的地 */
  destinations?: Destination[];
  /** 筛选变化回调 */
  onChange?: (filters: Partial<FilterType>) => void;
  /** 重置回调 */
  onReset?: () => void;
  /** 布局方式 */
  layout?: 'horizontal' | 'vertical';
  /** 是否显示高级筛选 */
  showAdvanced?: boolean;
}

const priceRanges = [
  { label: '全部价格', min: undefined, max: undefined },
  { label: '¥0 - ¥200', min: 0, max: 200 },
  { label: '¥200 - ¥500', min: 200, max: 500 },
  { label: '¥500 - ¥1000', min: 500, max: 1000 },
  { label: '¥1000+', min: 1000, max: undefined },
];

const ratingOptions = [
  { label: '全部评分', value: undefined },
  { label: '4.5分以上', value: 4.5 },
  { label: '4.0分以上', value: 4.0 },
  { label: '3.5分以上', value: 3.5 },
];

// Valid ProductTag values for feature tags
const featureTags: ProductTag[] = ['hot', 'recommended', 'new', 'discount'];

// Valid ProductTag values for type tags
const typeTags: ProductTag[] = ['family', 'couple', 'adventure', 'nature'];

export const ProductFilter: React.FC<ProductFilterProps> = ({
  filters = {},
  categories = [],
  destinations = [],
  onChange,
  onReset,
  layout = 'horizontal',
  showAdvanced = false,
}) => {
  const { t, i18n } = useTranslation();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(showAdvanced);

  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  const handleCategoryChange = (category: string | undefined) => {
    onChange?.({ ...filters, category });
    setExpandedSection(null);
  };

  const handleDestinationChange = (destination: string | undefined) => {
    onChange?.({ ...filters, destination });
    setExpandedSection(null);
  };

  const handlePriceChange = (min?: number, max?: number) => {
    onChange?.({ ...filters, priceMin: min, priceMax: max });
    setExpandedSection(null);
  };

  const handleRatingChange = (rating?: number) => {
    onChange?.({ ...filters, rating });
    setExpandedSection(null);
  };

  const handleSortChange = (sortBy: FilterType['sortBy']) => {
    onChange?.({ ...filters, sortBy });
  };

  const handleTagToggle = (tag: ProductTag) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    onChange?.({ ...filters, tags: newTags });
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.category) count++;
    if (filters.destination) count++;
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) count++;
    if (filters.rating !== undefined) count++;
    if (filters.tags && filters.tags.length > 0) count += filters.tags.length;
    return count;
  };

  const activeCount = getActiveFiltersCount();

  const selectedCategory = categories.find(c => c.id === filters.category);
  const selectedDestination = destinations.find(d => d.id === filters.destination);
  const selectedPriceRange = priceRanges.find(
    p => p.min === filters.priceMin && p.max === filters.priceMax
  ) || priceRanges[0];
  const selectedRating = ratingOptions.find(r => r.value === filters.rating) || ratingOptions[0];

  return (
    <div className={clsx(styles.container, styles[layout])}>
      {/* 快捷筛选栏 */}
      <div className={styles.quickFilters}>
        {/* 分类筛选 */}
        <div className={styles.filterGroup}>
          <button
            className={clsx(styles.filterButton, {
              [styles.active]: filters.category,
            })}
            onClick={() => toggleSection('category')}
          >
            <Filter size={16} />
            <span>{selectedCategory ? (isZh ? selectedCategory.name : selectedCategory.nameEn) : t('filter.category')}</span>
            <ChevronDown size={14} className={clsx(styles.chevron, { [styles.expanded]: expandedSection === 'category' })} />
          </button>
          {expandedSection === 'category' && (
            <div className={styles.dropdown}>
              <button
                className={clsx(styles.dropdownItem, { [styles.selected]: !filters.category })}
                onClick={() => handleCategoryChange(undefined)}
              >
                {t('filter.allCategories')}
              </button>
              {categories.map(category => (
                <button
                  key={category.id}
                  className={clsx(styles.dropdownItem, { [styles.selected]: filters.category === category.id })}
                  onClick={() => handleCategoryChange(category.id)}
                >
                  {isZh ? category.name : category.nameEn}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 目的地筛选 */}
        <div className={styles.filterGroup}>
          <button
            className={clsx(styles.filterButton, {
              [styles.active]: filters.destination,
            })}
            onClick={() => toggleSection('destination')}
          >
            <MapPin size={16} />
            <span>{selectedDestination ? (isZh ? selectedDestination.name : selectedDestination.nameEn) : t('filter.destination')}</span>
            <ChevronDown size={14} className={clsx(styles.chevron, { [styles.expanded]: expandedSection === 'destination' })} />
          </button>
          {expandedSection === 'destination' && (
            <div className={styles.dropdown}>
              <button
                className={clsx(styles.dropdownItem, { [styles.selected]: !filters.destination })}
                onClick={() => handleDestinationChange(undefined)}
              >
                {t('filter.allDestinations')}
              </button>
              {destinations.map(destination => (
                <button
                  key={destination.id}
                  className={clsx(styles.dropdownItem, { [styles.selected]: filters.destination === destination.id })}
                  onClick={() => handleDestinationChange(destination.id)}
                >
                  {isZh ? destination.name : destination.nameEn}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 价格筛选 */}
        <div className={styles.filterGroup}>
          <button
            className={clsx(styles.filterButton, {
              [styles.active]: filters.priceMin !== undefined || filters.priceMax !== undefined,
            })}
            onClick={() => toggleSection('price')}
          >
            <DollarSign size={16} />
            <span>{selectedPriceRange.label}</span>
            <ChevronDown size={14} className={clsx(styles.chevron, { [styles.expanded]: expandedSection === 'price' })} />
          </button>
          {expandedSection === 'price' && (
            <div className={styles.dropdown}>
              {priceRanges.map((range, index) => (
                <button
                  key={index}
                  className={clsx(styles.dropdownItem, {
                    [styles.selected]: range.min === filters.priceMin && range.max === filters.priceMax,
                  })}
                  onClick={() => handlePriceChange(range.min, range.max)}
                >
                  {range.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 评分筛选 */}
        <div className={styles.filterGroup}>
          <button
            className={clsx(styles.filterButton, {
              [styles.active]: filters.rating !== undefined,
            })}
            onClick={() => toggleSection('rating')}
          >
            <Star size={16} />
            <span>{selectedRating.label}</span>
            <ChevronDown size={14} className={clsx(styles.chevron, { [styles.expanded]: expandedSection === 'rating' })} />
          </button>
          {expandedSection === 'rating' && (
            <div className={styles.dropdown}>
              {ratingOptions.map((option, index) => (
                <button
                  key={index}
                  className={clsx(styles.dropdownItem, { [styles.selected]: option.value === filters.rating })}
                  onClick={() => handleRatingChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 高级筛选按钮 */}
        <button
          className={clsx(styles.advancedToggle, { [styles.active]: showAdvancedFilters })}
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          {t('filter.advancedFilters')}
          <ChevronDown size={14} className={clsx(styles.chevron, { [styles.expanded]: showAdvancedFilters })} />
        </button>

        {/* 清除筛选 */}
        {activeCount > 0 && (
          <button className={styles.clearButton} onClick={onReset}>
            <X size={14} />
            <span>{t('filter.clearAll')} ({activeCount})</span>
          </button>
        )}
      </div>

      {/* 高级筛选面板 */}
      {showAdvancedFilters && (
        <div className={styles.advancedPanel}>
          {/* 特色标签 */}
          <div className={styles.tagSection}>
            <span className={styles.tagLabel}>{t('filter.features')}:</span>
            <div className={styles.tagList}>
              {featureTags.map(tag => (
                <button
                  key={tag}
                  className={clsx(styles.tag, { [styles.selected]: filters.tags?.includes(tag) })}
                  onClick={() => handleTagToggle(tag)}
                >
                  {t(`tags.${tag}`)}
                </button>
              ))}
            </div>
          </div>

          {/* 类型标签 */}
          <div className={styles.tagSection}>
            <span className={styles.tagLabel}>{t('filter.types')}:</span>
            <div className={styles.tagList}>
              {typeTags.map(tag => (
                <button
                  key={tag}
                  className={clsx(styles.tag, { [styles.selected]: filters.tags?.includes(tag) })}
                  onClick={() => handleTagToggle(tag)}
                >
                  {t(`tags.${tag}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 排序选项 */}
      <div className={styles.sortBar}>
        <span className={styles.sortLabel}>{t('filter.sortBy')}:</span>
        <div className={styles.sortOptions}>
          {[
            { value: 'popularity', label: t('filter.sort.recommended') },
            { value: 'price_asc', label: t('filter.sort.priceAsc') },
            { value: 'price_desc', label: t('filter.sort.priceDesc') },
            { value: 'rating', label: t('filter.sort.rating') },
            { value: 'newest', label: t('filter.sort.newest') },
          ].map(option => (
            <button
              key={option.value}
              className={clsx(styles.sortOption, {
                [styles.active]: filters.sortBy === option.value || (!filters.sortBy && option.value === 'popularity'),
              })}
              onClick={() => handleSortChange(option.value as FilterType['sortBy'])}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductFilter;
