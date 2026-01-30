import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';
import styles from './StatCard.module.css';

export interface StatCardProps {
  /** 标题 */
  title: string;
  /** 标题英文 */
  titleEn?: string;
  /** 数值 */
  value: string | number;
  /** 单位 */
  unit?: string;
  /** 图标 */
  icon?: React.ReactNode;
  /** 趋势方向 */
  trend?: 'up' | 'down' | 'neutral';
  /** 趋势数值 */
  trendValue?: string;
  /** 趋势描述 */
  trendLabel?: string;
  /** 趋势描述英文 */
  trendLabelEn?: string;
  /** 变体样式 */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否加载中 */
  loading?: boolean;
  /** 语言 */
  language?: 'zh' | 'en';
  /** 点击回调 */
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  titleEn,
  value,
  unit,
  icon,
  trend,
  trendValue,
  trendLabel,
  trendLabelEn,
  variant = 'default',
  size = 'md',
  loading = false,
  language,
  onClick,
}) => {
  const { i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const displayTitle = isZh ? title : (titleEn || title);
  const displayTrendLabel = isZh ? trendLabel : (trendLabelEn || trendLabel);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  if (loading) {
    return (
      <div className={clsx(styles.card, styles[variant], styles[size], styles.loading)}>
        <div className={styles.skeletonIcon} />
        <div className={styles.skeletonContent}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonValue} />
          <div className={styles.skeletonTrend} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        styles.card,
        styles[variant],
        styles[size],
        onClick && styles.clickable
      )}
      onClick={onClick}
    >
      {icon && (
        <div className={styles.iconWrapper}>
          {icon}
        </div>
      )}
      <div className={styles.content}>
        <h3 className={styles.title}>{displayTitle}</h3>
        <div className={styles.valueRow}>
          <span className={styles.value}>{value}</span>
          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
        {(trend || trendValue) && (
          <div className={clsx(styles.trend, trend && styles[`trend${trend.charAt(0).toUpperCase() + trend.slice(1)}`])}>
            {trend && <TrendIcon size={14} />}
            {trendValue && <span className={styles.trendValue}>{trendValue}</span>}
            {displayTrendLabel && <span className={styles.trendLabel}>{displayTrendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
