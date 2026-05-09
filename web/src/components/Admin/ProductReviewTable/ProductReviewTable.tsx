import React, { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
const ProductPrecheck = lazy(() => import('../../AI/ProductPrecheck/ProductPrecheck'));
import { Eye, CheckCircle, XCircle, Image, Pencil, Trash2, Package } from 'lucide-react';
import clsx from 'clsx';
import styles from './ProductReviewTable.module.css';

export type ProductReviewStatus = 'pending' | 'approved' | 'rejected';

// REQ-20260509-0030: 旧的 ProductCategory string enum 与 DB 实际 category.slug
// 完全不匹配（前端写死 day_tour/multi_day/activity/ticket，DB 用 day-tours/
// wine/wildlife/...），强制 cast 后所有产品分类列都成 'other'，label 找不到 →
// 空白。改为 nullable category 对象，name_zh/name_en 直接从后端来，不再走任何
// 枚举映射。旧 enum 名作为 deprecated alias 保留以免外部 import 编译错误。
export interface ProductCategoryRef {
  id?: number;
  slug?: string;
  name_zh?: string;
  name_en?: string;
}

/** @deprecated REQ-20260509-0030 — use ProductCategoryRef. */
export type ProductCategory = ProductCategoryRef;

export interface ProductReview {
  id: string;
  name: string;
  nameEn?: string;
  category?: ProductCategoryRef;
  supplierId: string;
  supplierName: string;
  price: number;
  originalPrice?: number;
  status: ProductReviewStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
  thumbnail?: string;
  description?: string;
}

export interface ProductReviewTableProps {
  products: ProductReview[];
  loading?: boolean;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  onView?: (product: ProductReview) => void;
  onApprove?: (product: ProductReview) => void;
  onReject?: (product: ProductReview) => void;
  onEdit?: (product: ProductReview) => void;
  onDelete?: (product: ProductReview) => void;
  // REQ-20260509-0035 Phase 2: 列表页直接调库存。
  onAdjustStock?: (product: ProductReview) => void;
}

export const ProductReviewTable: React.FC<ProductReviewTableProps> = ({
  products,
  loading = false,
  selectedIds = [],
  onSelect,
  onView,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onAdjustStock,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  const getStatusLabel = (status: ProductReviewStatus) => {
    const labels: Record<ProductReviewStatus, string> = {
      pending: t('admin.products.status.pending'),
      approved: t('admin.products.status.approved'),
      rejected: t('admin.products.status.rejected'),
    };
    return labels[status];
  };

  // REQ-20260509-0030: 直接读后端 category 对象的本地化字段，缺失就回退到
  // slug 再回退到 "—"。不再走前端写死的枚举 → label 映射。
  const getCategoryLabel = (category?: ProductCategoryRef) => {
    if (!category) return '—';
    const localized = isZh ? category.name_zh : category.name_en;
    return localized || category.name_en || category.name_zh || category.slug || '—';
  };

  const formatPrice = (price: number) => {
    return `A$${price.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (onSelect) {
      onSelect(checked ? products.map((p) => p.id) : []);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (onSelect) {
      if (checked) {
        onSelect([...selectedIds, id]);
      } else {
        onSelect(selectedIds.filter((i) => i !== id));
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxCell}></th>
              <th>{t('admin.products.table.product')}</th>
              <th>{t('admin.products.table.category')}</th>
              <th>{t('admin.products.table.supplier')}</th>
              <th>{t('admin.products.table.price')}</th>
              <th>{t('admin.products.table.status')}</th>
              <th>{t('admin.products.table.submitDate')}</th>
              <th>{t('admin.products.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className={styles.skeletonRow}>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className={styles.empty}>
        <p>{t('admin.products.empty')}</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.checkboxCell}>
              <input
                type="checkbox"
                checked={selectedIds.length === products.length && products.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </th>
            <th>{t('admin.products.table.product')}</th>
            <th>{t('admin.products.table.category')}</th>
            <th>{t('admin.products.table.supplier')}</th>
            <th>{t('admin.products.table.price')}</th>
            <th>{t('admin.products.table.status')}</th>
            <th>AI</th>
            <th>{t('admin.products.table.submitDate')}</th>
            <th>{t('admin.products.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className={clsx(selectedIds.includes(product.id) && styles.selected)}>
              <td className={styles.checkboxCell}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(product.id)}
                  onChange={(e) => handleSelectOne(product.id, e.target.checked)}
                />
              </td>
              <td>
                <div className={styles.productInfo}>
                  {product.thumbnail ? (
                    <img src={product.thumbnail} alt="" className={styles.thumbnail} />
                  ) : (
                    <div className={styles.thumbnailPlaceholder}>
                      <Image size={20} />
                    </div>
                  )}
                  <div className={styles.nameInfo}>
                    <span className={styles.name}>{product.name}</span>
                    {product.nameEn && (
                      <span className={styles.nameEn}>{product.nameEn}</span>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <span className={styles.categoryTag}>{getCategoryLabel(product.category)}</span>
              </td>
              <td>
                <span className={styles.supplierName}>{product.supplierName}</span>
              </td>
              <td>
                <div className={styles.priceInfo}>
                  <span className={styles.price}>{formatPrice(product.price)}</span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className={styles.originalPrice}>{formatPrice(product.originalPrice)}</span>
                  )}
                </div>
              </td>
              <td>
                <span className={clsx(styles.statusBadge, styles[product.status])}>
                  {getStatusLabel(product.status)}
                </span>
              </td>
              <td><Suspense fallback={<span style={{color:'#999',fontSize:12}}>...</span>}><ProductPrecheck productId={Number(product.id)} /></Suspense></td>
              <td>{formatDate(product.submittedAt)}</td>
              <td>
                <div className={styles.actions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onView?.(product)}
                    title={t('admin.products.actions.view')}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onEdit?.(product)}
                    title={t('admin.products.actions.edit')}
                  >
                    <Pencil size={16} />
                  </button>
                  {onAdjustStock && (
                    <button
                      className={styles.actionBtn}
                      onClick={() => onAdjustStock(product)}
                      title={t('admin.products.actions.adjustStock', '调整库存') as string}
                    >
                      <Package size={16} />
                    </button>
                  )}
                  {product.status === 'pending' && (
                    <>
                      <button
                        className={clsx(styles.actionBtn, styles.approve)}
                        onClick={() => onApprove?.(product)}
                        title={t('admin.products.actions.approve')}
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        className={clsx(styles.actionBtn, styles.reject)}
                        onClick={() => onReject?.(product)}
                        title={t('admin.products.actions.reject')}
                      >
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                  <button
                    className={clsx(styles.actionBtn, styles.reject)}
                    onClick={() => onDelete?.(product)}
                    title={t('admin.products.actions.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductReviewTable;
