import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  Compass,
  Calendar,
  Ticket,
  Utensils,
  Mountain,
  Waves,
  Wine,
  Camera,
  Users,
  Car,
  type LucideIcon,
} from 'lucide-react';
import styles from './CategoryCard.module.css';
import type { ProductCategory } from '../../../types';

export interface CategoryCardProps {
  /** 分类数据 */
  category: ProductCategory;
  /** 产品数量 */
  productCount?: number;
  /** 图标名称或自定义图标 */
  icon?: string | LucideIcon;
  /** 背景图片 */
  backgroundImage?: string;
  /** 背景颜色 */
  backgroundColor?: string;
  /** 卡片变体 */
  variant?: 'default' | 'compact' | 'icon-only';
  /** 是否选中 */
  selected?: boolean;
  /** 点击回调 */
  onClick?: (category: ProductCategory) => void;
  /** 语言 */
  language?: 'zh' | 'en';
}

const iconMap: Record<string, LucideIcon> = {
  '一日游': Calendar,
  '多日游': Compass,
  '门票': Ticket,
  '美食体验': Utensils,
  '户外探险': Mountain,
  '水上活动': Waves,
  '酒庄之旅': Wine,
  '摄影之旅': Camera,
  '团队活动': Users,
  '租车自驾': Car,
  'Day Tours': Calendar,
  'Multi-day Tours': Compass,
  'Tickets & Passes': Ticket,
  'Food & Dining': Utensils,
  'Outdoor Adventures': Mountain,
  'Water Activities': Waves,
  'Wine Tours': Wine,
  'Photography Tours': Camera,
  'Group Activities': Users,
  'Car Rental': Car,
};

const colorMap: Record<string, string> = {
  '一日游': '#0077B6',
  '多日游': '#2D6A4F',
  '门票': '#E85D04',
  '美食体验': '#D62828',
  '户外探险': '#386641',
  '水上活动': '#00B4D8',
  '酒庄之旅': '#7209B7',
  '摄影之旅': '#F72585',
  '团队活动': '#4361EE',
  '租车自驾': '#3A0CA3',
};

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  productCount = 0,
  icon,
  backgroundImage,
  backgroundColor,
  variant = 'default',
  selected = false,
  onClick,
  language,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const name = isZh ? category.name : category.nameEn;

  // Determine icon
  let IconComponent: LucideIcon = Compass;
  if (typeof icon === 'string') {
    IconComponent = iconMap[icon] || iconMap[category.name] || iconMap[category.nameEn] || Compass;
  } else if (icon) {
    IconComponent = icon;
  } else {
    IconComponent = iconMap[category.name] || iconMap[category.nameEn] || Compass;
  }

  // Determine background color
  const bgColor = backgroundColor || colorMap[category.name] || '#0077B6';

  const cardStyle = backgroundImage
    ? { backgroundImage: `url(${backgroundImage})` }
    : { backgroundColor: bgColor };

  return (
    <article
      className={clsx(styles.card, styles[variant], {
        [styles.selected]: selected,
        [styles.hasImage]: !!backgroundImage,
      })}
      style={cardStyle}
      onClick={() => onClick?.(category)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(category);
        }
      }}
    >
      {backgroundImage && <div className={styles.overlay} />}

      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <IconComponent size={variant === 'compact' ? 20 : variant === 'icon-only' ? 28 : 24} />
        </div>

        {variant !== 'icon-only' && (
          <>
            <h3 className={styles.name}>{name}</h3>
            {variant === 'default' && productCount > 0 && (
              <span className={styles.count}>
                {productCount} {t('category.products')}
              </span>
            )}
          </>
        )}
      </div>
    </article>
  );
};

export default CategoryCard;
