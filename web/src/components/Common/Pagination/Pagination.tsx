import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import clsx from 'clsx';
import styles from './Pagination.module.css';

export interface PaginationProps {
  /** 当前页码 */
  current: number;
  /** 总条数 */
  total: number;
  /** 每页条数 */
  pageSize?: number;
  /** 显示的页码数量 */
  siblingCount?: number;
  /** 是否显示快速跳转 */
  showQuickJumper?: boolean;
  /** 是否显示每页条数选择器 */
  showSizeChanger?: boolean;
  /** 每页条数选项 */
  pageSizeOptions?: number[];
  /** 是否显示总条数 */
  showTotal?: boolean;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否禁用 */
  disabled?: boolean;
  /** 语言 */
  language?: 'zh' | 'en';
  /** 页码变化回调 */
  onChange?: (page: number, pageSize: number) => void;
  /** 每页条数变化回调 */
  onPageSizeChange?: (pageSize: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  current,
  total,
  pageSize = 10,
  siblingCount = 1,
  showQuickJumper = false,
  showSizeChanger = false,
  pageSizeOptions = [10, 20, 50, 100],
  showTotal = true,
  size = 'md',
  disabled = false,
  language,
  onChange,
  onPageSizeChange,
}) => {
  const { i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const totalPages = Math.ceil(total / pageSize);

  // Generate page numbers array
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const leftSiblingIndex = Math.max(current - siblingCount, 1);
    const rightSiblingIndex = Math.min(current + siblingCount, totalPages);

    const showLeftEllipsis = leftSiblingIndex > 2;
    const showRightEllipsis = rightSiblingIndex < totalPages - 1;

    if (!showLeftEllipsis && showRightEllipsis) {
      const leftItemCount = 3 + 2 * siblingCount;
      for (let i = 1; i <= Math.min(leftItemCount, totalPages); i++) {
        pages.push(i);
      }
      if (totalPages > leftItemCount) {
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    } else if (showLeftEllipsis && !showRightEllipsis) {
      const rightItemCount = 3 + 2 * siblingCount;
      pages.push(1);
      pages.push('ellipsis');
      for (let i = Math.max(totalPages - rightItemCount + 1, 1); i <= totalPages; i++) {
        pages.push(i);
      }
    } else if (showLeftEllipsis && showRightEllipsis) {
      pages.push(1);
      pages.push('ellipsis');
      for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
        pages.push(i);
      }
      pages.push('ellipsis');
      pages.push(totalPages);
    } else {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === current || disabled) return;
    onChange?.(page, pageSize);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = Number(e.target.value);
    onPageSizeChange?.(newPageSize);
    // Reset to first page when page size changes
    onChange?.(1, newPageSize);
  };

  const handleQuickJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const page = Number((e.target as HTMLInputElement).value);
      if (page >= 1 && page <= totalPages) {
        handlePageChange(page);
        (e.target as HTMLInputElement).value = '';
      }
    }
  };

  if (totalPages <= 0) return null;

  const pageNumbers = getPageNumbers();

  return (
    <div className={clsx(styles.pagination, styles[size], disabled && styles.disabled)}>
      {/* Total */}
      {showTotal && (
        <span className={styles.total}>
          {isZh ? `共 ${total} 条` : `${total} items`}
        </span>
      )}

      {/* Page Size Changer */}
      {showSizeChanger && (
        <select
          className={styles.sizeChanger}
          value={pageSize}
          onChange={handlePageSizeChange}
          disabled={disabled}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {isZh ? `${option} 条/页` : `${option} / page`}
            </option>
          ))}
        </select>
      )}

      {/* Navigation */}
      <div className={styles.nav}>
        {/* First Page */}
        <button
          className={clsx(styles.navButton, current === 1 && styles.disabled)}
          onClick={() => handlePageChange(1)}
          disabled={current === 1 || disabled}
          title={isZh ? '第一页' : 'First page'}
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Previous */}
        <button
          className={clsx(styles.navButton, current === 1 && styles.disabled)}
          onClick={() => handlePageChange(current - 1)}
          disabled={current === 1 || disabled}
          title={isZh ? '上一页' : 'Previous'}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page Numbers */}
        {pageNumbers.map((page, index) => (
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className={styles.ellipsis}>
              ...
            </span>
          ) : (
            <button
              key={page}
              className={clsx(
                styles.pageButton,
                page === current && styles.active
              )}
              onClick={() => handlePageChange(page)}
              disabled={disabled}
            >
              {page}
            </button>
          )
        ))}

        {/* Next */}
        <button
          className={clsx(styles.navButton, current === totalPages && styles.disabled)}
          onClick={() => handlePageChange(current + 1)}
          disabled={current === totalPages || disabled}
          title={isZh ? '下一页' : 'Next'}
        >
          <ChevronRight size={16} />
        </button>

        {/* Last Page */}
        <button
          className={clsx(styles.navButton, current === totalPages && styles.disabled)}
          onClick={() => handlePageChange(totalPages)}
          disabled={current === totalPages || disabled}
          title={isZh ? '最后一页' : 'Last page'}
        >
          <ChevronsRight size={16} />
        </button>
      </div>

      {/* Quick Jumper */}
      {showQuickJumper && (
        <div className={styles.jumper}>
          <span>{isZh ? '跳至' : 'Go to'}</span>
          <input
            type="number"
            className={styles.jumperInput}
            min={1}
            max={totalPages}
            onKeyDown={handleQuickJump}
            disabled={disabled}
          />
          <span>{isZh ? '页' : ''}</span>
        </div>
      )}
    </div>
  );
};

export default Pagination;
