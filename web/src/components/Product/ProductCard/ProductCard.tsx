import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Star, MapPin, Clock, Heart, Check, Zap } from 'lucide-react';
import type { Product, ProductTag } from '../../../types';
import { formatPrice } from '../../../utils/formatPrice';
import styles from './ProductCard.module.css';

export interface ProductCardProps {
  /** 产品数据 */
  product: Product;
  /** 是否已收藏 */
  isFavorite?: boolean;
  /** 点击产品 */
  onClick?: (product: Product) => void;
  /** 收藏/取消收藏 */
  onFavoriteToggle?: (product: Product) => void;
  /** 加入购物车 */
  onAddToCart?: (product: Product) => void;
  /** 变体样式 */
  variant?: 'default' | 'compact' | 'horizontal';
  /** 语言 */
  language?: 'zh' | 'en';
}

const tagIcons: Record<ProductTag, React.ReactNode> = {
  hot: '🔥',
  new: '✨',
  discount: '💰',
  recommended: '👍',
  family: '👨‍👩‍👧‍👦',
  couple: '💑',
  adventure: '🏔️',
  nature: '🌿',
  food: '🍽️',
  culture: '🏛️',
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isFavorite = false,
  onClick,
  onFavoriteToggle,
  onAddToCart,
  variant = 'default',
  language = 'zh',
}) => {
  const { t } = useTranslation();
  const isZh = language === 'zh';

  const title = isZh ? product.title : (product.titleEn || product.title);
  const location = isZh ? product.location : (product.locationEn || product.location);
  const duration = isZh ? product.duration : (product.durationEn || product.duration);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick?.(product);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavoriteToggle?.(product);
  };

  const [addedToCart, setAddedToCart] = useState(false);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart?.(product);
    setAddedToCart(true);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setAddedToCart(false), 1500);
  };

  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice!) * 100)
    : 0;

  return (
    <article
      className={clsx(styles.card, styles[variant])}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      {/* 图片区域 */}
      <div className={styles.imageWrapper}>
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={title}
            className={styles.image}
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className={styles.image} style={{ background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '2rem' }}>📷</div>
        )}

        {/* 标签 */}
        {product.tags.length > 0 && (
          <div className={styles.tags}>
            {product.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className={clsx(styles.tag, styles[`tag-${tag}`])}
              >
                {tagIcons[tag]} {t(`tags.${tag}`)}
              </span>
            ))}
          </div>
        )}

        {/* 折扣角标 */}
        {hasDiscount && (
          <div className={styles.discountBadge}>
            -{discountPercent}%
          </div>
        )}

        {/* 收藏按钮 */}
        <button
          className={clsx(styles.favoriteButton, { [styles.favorited]: isFavorite })}
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? t('product.removeFromFavorites') : t('product.addToFavorites')}
        >
          <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        {/* 可用性指示 */}
        {product.availability === 'sold_out' && (
          <div className={clsx(styles.availabilityBadge, styles.soldOutBadge)}>
            {t('product.soldOut')}
          </div>
        )}
        {product.availability === 'limited' && (
          <div className={styles.availabilityBadge}>
            {t('product.limited')}
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>

        {/* 位置和时长 */}
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <MapPin size={14} />
            {location}
          </span>
          {duration && (
            <span className={styles.metaItem}>
              <Clock size={14} />
              {duration}
            </span>
          )}
        </div>

        {/* 评分 */}
        <div className={styles.rating}>
          <Star size={16} className={styles.starIcon} />
          <span className={styles.ratingValue}>{product.rating.toFixed(1)}</span>
          <span className={styles.reviewCount}>
            ({product.reviewCount} {t('product.reviews')})
          </span>
        </div>

        {/* 特色标签 */}
        <div className={styles.features}>
          {product.instantConfirmation && (
            <span className={styles.feature}>
              <Zap size={12} />
              {t('product.instantConfirmation')}
            </span>
          )}
          {product.freeCancellation && (
            <span className={styles.feature}>
              <Check size={12} />
              {t('product.freeCancellation')}
            </span>
          )}
        </div>

        {/* 价格 */}
        <div className={styles.priceRow}>
          <div className={styles.price}>
            <span className={styles.amount}>{formatPrice(product.price, product.currency)}</span>
            <span className={styles.priceLabel}>{t('product.priceFrom')}</span>
          </div>
          {hasDiscount && (
            <span className={styles.originalPrice}>
              {formatPrice(product.originalPrice ?? 0, product.currency)}
            </span>
          )}
        </div>

        {/* 预订按钮（仅在 horizontal 变体显示） */}
        {variant === 'horizontal' && (
          <button
            className={clsx(styles.addToCartButton, addedToCart && styles.addedToCart)}
            onClick={handleAddToCart}
            disabled={product.availability === 'sold_out'}
          >
            {product.availability === 'sold_out'
              ? t('product.soldOut')
              : addedToCart
                ? `${t('cart.added')} ✓`
                : t('product.addToCart')
            }
          </button>
        )}
      </div>
    </article>
  );
};

export default ProductCard;
