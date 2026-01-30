import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, Grid, List, ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';
import { SupplierCard } from '../SupplierCard';
import type { Supplier } from '../SupplierCard';
import styles from './SupplierList.module.css';

export interface SupplierListProps {
  /** 供应商列表 */
  suppliers: Supplier[];
  /** 加载状态 */
  loading?: boolean;
  /** 视图模式 */
  viewMode?: 'grid' | 'list';
  /** 状态筛选 */
  statusFilter?: 'all' | 'active' | 'pending' | 'suspended';
  /** 排序方式 */
  sortBy?: 'rating' | 'products' | 'reviews' | 'name';
  /** 搜索关键词 */
  searchKeyword?: string;
  /** 显示筛选栏 */
  showFilters?: boolean;
  /** 显示搜索栏 */
  showSearch?: boolean;
  /** 空状态图片 */
  emptyImage?: string;
  /** 空状态文本 */
  emptyText?: string;
  /** 语言 */
  language?: 'zh' | 'en';
  /** 点击供应商 */
  onSupplierClick?: (supplier: Supplier) => void;
  /** 查看产品 */
  onViewProducts?: (supplier: Supplier) => void;
  /** 视图模式切换 */
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  /** 状态筛选变化 */
  onStatusFilterChange?: (status: 'all' | 'active' | 'pending' | 'suspended') => void;
  /** 排序变化 */
  onSortChange?: (sortBy: 'rating' | 'products' | 'reviews' | 'name') => void;
  /** 搜索 */
  onSearch?: (keyword: string) => void;
}

const statusOptions = [
  { value: 'all', labelZh: '全部', labelEn: 'All' },
  { value: 'active', labelZh: '已认证', labelEn: 'Verified' },
  { value: 'pending', labelZh: '审核中', labelEn: 'Pending' },
  { value: 'suspended', labelZh: '已停用', labelEn: 'Suspended' },
];

const sortOptions = [
  { value: 'rating', labelZh: '评分最高', labelEn: 'Highest Rated' },
  { value: 'products', labelZh: '产品最多', labelEn: 'Most Products' },
  { value: 'reviews', labelZh: '评价最多', labelEn: 'Most Reviews' },
  { value: 'name', labelZh: '名称排序', labelEn: 'Name' },
];

export const SupplierList: React.FC<SupplierListProps> = ({
  suppliers,
  loading = false,
  viewMode = 'grid',
  statusFilter = 'all',
  sortBy = 'rating',
  searchKeyword = '',
  showFilters = true,
  showSearch = true,
  emptyImage,
  emptyText,
  language,
  onSupplierClick,
  onViewProducts,
  onViewModeChange,
  onStatusFilterChange,
  onSortChange,
  onSearch,
}) => {
  const { i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const [localSearchKeyword, setLocalSearchKeyword] = useState(searchKeyword);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const handleSearch = () => {
    onSearch?.(localSearchKeyword);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setLocalSearchKeyword('');
    onSearch?.('');
  };

  const currentStatusOption = statusOptions.find(opt => opt.value === statusFilter);
  const currentSortOption = sortOptions.find(opt => opt.value === sortBy);

  // Filter and sort suppliers
  const filteredSuppliers = suppliers
    .filter(supplier => {
      if (statusFilter !== 'all' && supplier.status !== statusFilter) {
        return false;
      }
      if (localSearchKeyword) {
        const keyword = localSearchKeyword.toLowerCase();
        return (
          supplier.name.toLowerCase().includes(keyword) ||
          supplier.nameEn?.toLowerCase().includes(keyword) ||
          supplier.location.toLowerCase().includes(keyword) ||
          supplier.locationEn?.toLowerCase().includes(keyword)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'products':
          return b.productCount - a.productCount;
        case 'reviews':
          return b.reviewCount - a.reviewCount;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

  const isEmpty = filteredSuppliers.length === 0 && !loading;

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      {(showSearch || showFilters) && (
        <div className={styles.toolbar}>
          {/* Search */}
          {showSearch && (
            <div className={styles.searchWrapper}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={isZh ? '搜索供应商名称、地区...' : 'Search suppliers...'}
                value={localSearchKeyword}
                onChange={(e) => setLocalSearchKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              {localSearchKeyword && (
                <button className={styles.clearButton} onClick={handleClearSearch}>
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          {/* Filters */}
          {showFilters && (
            <div className={styles.filters}>
              {/* Status Filter */}
              <div className={styles.filterDropdown}>
                <button
                  className={styles.filterButton}
                  onClick={() => {
                    setShowStatusDropdown(!showStatusDropdown);
                    setShowSortDropdown(false);
                  }}
                >
                  <Filter size={16} />
                  <span>{isZh ? currentStatusOption?.labelZh : currentStatusOption?.labelEn}</span>
                  <ChevronDown size={14} />
                </button>
                {showStatusDropdown && (
                  <div className={styles.dropdownMenu}>
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        className={clsx(
                          styles.dropdownItem,
                          statusFilter === option.value && styles.active
                        )}
                        onClick={() => {
                          onStatusFilterChange?.(option.value as typeof statusFilter);
                          setShowStatusDropdown(false);
                        }}
                      >
                        {isZh ? option.labelZh : option.labelEn}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className={styles.filterDropdown}>
                <button
                  className={styles.filterButton}
                  onClick={() => {
                    setShowSortDropdown(!showSortDropdown);
                    setShowStatusDropdown(false);
                  }}
                >
                  <span>{isZh ? currentSortOption?.labelZh : currentSortOption?.labelEn}</span>
                  <ChevronDown size={14} />
                </button>
                {showSortDropdown && (
                  <div className={styles.dropdownMenu}>
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        className={clsx(
                          styles.dropdownItem,
                          sortBy === option.value && styles.active
                        )}
                        onClick={() => {
                          onSortChange?.(option.value as typeof sortBy);
                          setShowSortDropdown(false);
                        }}
                      >
                        {isZh ? option.labelZh : option.labelEn}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View Mode Toggle */}
              <div className={styles.viewToggle}>
                <button
                  className={clsx(styles.viewButton, viewMode === 'grid' && styles.active)}
                  onClick={() => onViewModeChange?.('grid')}
                  title={isZh ? '网格视图' : 'Grid View'}
                >
                  <Grid size={18} />
                </button>
                <button
                  className={clsx(styles.viewButton, viewMode === 'list' && styles.active)}
                  onClick={() => onViewModeChange?.('list')}
                  title={isZh ? '列表视图' : 'List View'}
                >
                  <List size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Count */}
      <div className={styles.resultsInfo}>
        <span>
          {isZh
            ? `共 ${filteredSuppliers.length} 家供应商`
            : `${filteredSuppliers.length} suppliers found`}
        </span>
      </div>

      {/* Loading State */}
      {loading && (
        <div className={clsx(styles.grid, viewMode === 'list' && styles.listView)}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={styles.skeleton}>
              <div className={styles.skeletonHeader}>
                <div className={styles.skeletonAvatar} />
                <div className={styles.skeletonInfo}>
                  <div className={styles.skeletonTitle} />
                  <div className={styles.skeletonSubtitle} />
                </div>
              </div>
              <div className={styles.skeletonStats} />
              <div className={styles.skeletonButton} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className={styles.emptyState}>
          {emptyImage ? (
            <img src={emptyImage} alt="" className={styles.emptyImage} />
          ) : (
            <div className={styles.emptyIcon}>🏢</div>
          )}
          <p className={styles.emptyText}>
            {emptyText || (isZh ? '暂无符合条件的供应商' : 'No suppliers found')}
          </p>
          {localSearchKeyword && (
            <button className={styles.clearSearchButton} onClick={handleClearSearch}>
              {isZh ? '清除搜索' : 'Clear Search'}
            </button>
          )}
        </div>
      )}

      {/* Supplier Grid/List */}
      {!loading && !isEmpty && (
        <div className={clsx(styles.grid, viewMode === 'list' && styles.listView)}>
          {filteredSuppliers.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              variant={viewMode === 'list' ? 'compact' : 'default'}
              language={language}
              onClick={onSupplierClick}
              onViewProducts={onViewProducts}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SupplierList;
