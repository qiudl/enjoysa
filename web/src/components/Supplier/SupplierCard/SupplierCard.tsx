import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Star, Package, CheckCircle, Clock, XCircle } from 'lucide-react';
import clsx from 'clsx';
import styles from './SupplierCard.module.css';

export interface Supplier {
  id: string;
  name: string;
  nameEn?: string;
  logo?: string;
  location: string;
  locationEn?: string;
  rating: number;
  reviewCount: number;
  productCount: number;
  status: 'active' | 'pending' | 'suspended';
  verifiedAt?: string;
  description?: string;
  descriptionEn?: string;
  tags?: string[];
}

export interface SupplierCardProps {
  /** 供应商数据 */
  supplier: Supplier;
  /** 变体样式 */
  variant?: 'default' | 'compact' | 'detailed';
  /** 点击回调 */
  onClick?: (supplier: Supplier) => void;
  /** 查看产品回调 */
  onViewProducts?: (supplier: Supplier) => void;
  /** 语言 */
  language?: 'zh' | 'en';
}

const statusConfig = {
  active: { color: 'var(--color-success)', icon: CheckCircle, label: '已认证' },
  pending: { color: 'var(--color-warning)', icon: Clock, label: '审核中' },
  suspended: { color: 'var(--color-error)', icon: XCircle, label: '已停用' },
};

export const SupplierCard: React.FC<SupplierCardProps> = ({
  supplier,
  variant = 'default',
  onClick,
  onViewProducts,
  language,
}) => {
  const { i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const name = isZh ? supplier.name : (supplier.nameEn || supplier.name);
  const location = isZh ? supplier.location : (supplier.locationEn || supplier.location);
  const description = isZh ? supplier.description : (supplier.descriptionEn || supplier.description);

  const statusInfo = statusConfig[supplier.status];
  const StatusIcon = statusInfo.icon;

  if (variant === 'compact') {
    return (
      <div
        className={clsx(styles.card, styles.compact)}
        onClick={() => onClick?.(supplier)}
      >
        <div className={styles.logoWrapper}>
          {supplier.logo ? (
            <img src={supplier.logo} alt={name} className={styles.logo} />
          ) : (
            <div className={styles.logoPlaceholder}>
              {name.charAt(0)}
            </div>
          )}
        </div>
        <div className={styles.compactInfo}>
          <h3 className={styles.compactName}>{name}</h3>
          <div className={styles.compactMeta}>
            <span className={styles.rating}>
              <Star size={12} fill="currentColor" />
              {supplier.rating.toFixed(1)}
            </span>
            <span className={styles.products}>
              <Package size={12} />
              {supplier.productCount}
            </span>
          </div>
        </div>
        <div
          className={styles.statusBadge}
          style={{ color: statusInfo.color }}
        >
          <StatusIcon size={14} />
        </div>
      </div>
    );
  }

  return (
    <article
      className={clsx(styles.card, variant === 'detailed' && styles.detailed)}
      onClick={() => onClick?.(supplier)}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.logoWrapper}>
          {supplier.logo ? (
            <img src={supplier.logo} alt={name} className={styles.logo} />
          ) : (
            <div className={styles.logoPlaceholder}>
              {name.charAt(0)}
            </div>
          )}
        </div>
        <div className={styles.headerInfo}>
          <div className={styles.nameRow}>
            <h3 className={styles.name}>{name}</h3>
            <div
              className={styles.statusBadge}
              style={{
                color: statusInfo.color,
                backgroundColor: `${statusInfo.color}15`,
              }}
            >
              <StatusIcon size={14} />
              <span>{statusInfo.label}</span>
            </div>
          </div>
          <div className={styles.location}>
            <MapPin size={14} />
            <span>{location}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <Star size={16} fill="var(--color-warning)" color="var(--color-warning)" />
          <span className={styles.statValue}>{supplier.rating.toFixed(1)}</span>
          <span className={styles.statLabel}>({supplier.reviewCount}评价)</span>
        </div>
        <div className={styles.stat}>
          <Package size={16} />
          <span className={styles.statValue}>{supplier.productCount}</span>
          <span className={styles.statLabel}>产品</span>
        </div>
      </div>

      {/* Description (detailed variant) */}
      {variant === 'detailed' && description && (
        <p className={styles.description}>{description}</p>
      )}

      {/* Tags */}
      {supplier.tags && supplier.tags.length > 0 && (
        <div className={styles.tags}>
          {supplier.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.viewButton}
          onClick={(e) => {
            e.stopPropagation();
            onViewProducts?.(supplier);
          }}
        >
          查看产品
        </button>
      </div>
    </article>
  );
};

export default SupplierCard;
