import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './Loading.module.css';

export interface LoadingProps {
  /** 加载类型 */
  type?: 'spinner' | 'dots' | 'skeleton' | 'pulse';
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 是否全屏 */
  fullscreen?: boolean;
  /** 是否显示文字 */
  showText?: boolean;
  /** 自定义文字 */
  text?: string;
  /** 骨架屏行数 */
  skeletonLines?: number;
  /** 颜色 */
  color?: 'primary' | 'white' | 'gray';
}

export const Loading: React.FC<LoadingProps> = ({
  type = 'spinner',
  size = 'md',
  fullscreen = false,
  showText = true,
  text,
  skeletonLines = 3,
  color = 'primary',
}) => {
  const { t } = useTranslation();
  const loadingText = text || t('common.loading');

  const renderLoader = () => {
    switch (type) {
      case 'dots':
        return (
          <div className={clsx(styles.dots, styles[size], styles[color])}>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
          </div>
        );

      case 'skeleton':
        return (
          <div className={styles.skeleton}>
            {Array(skeletonLines)
              .fill(0)
              .map((_, index) => (
                <div
                  key={index}
                  className={clsx(
                    styles.skeletonLine,
                    index === skeletonLines - 1 && styles.short
                  )}
                />
              ))}
          </div>
        );

      case 'pulse':
        return (
          <div className={clsx(styles.pulse, styles[size], styles[color])}>
            <div className={styles.pulseInner}></div>
          </div>
        );

      default:
        return (
          <div className={clsx(styles.spinner, styles[size], styles[color])}>
            <svg viewBox="0 0 50 50" className={styles.spinnerSvg}>
              <circle
                className={styles.spinnerCircle}
                cx="25"
                cy="25"
                r="20"
                fill="none"
                strokeWidth="4"
              />
            </svg>
          </div>
        );
    }
  };

  if (fullscreen) {
    return (
      <div className={styles.fullscreen}>
        <div className={styles.fullscreenContent}>
          {renderLoader()}
          {showText && type !== 'skeleton' && (
            <p className={styles.text}>{loadingText}</p>
          )}
        </div>
      </div>
    );
  }

  if (type === 'skeleton') {
    return renderLoader();
  }

  return (
    <div className={styles.container}>
      {renderLoader()}
      {showText && <p className={clsx(styles.text, styles[size])}>{loadingText}</p>}
    </div>
  );
};

// Card Skeleton 组件
export interface CardSkeletonProps {
  count?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ count = 1 }) => {
  return (
    <>
      {Array(count)
        .fill(0)
        .map((_, index) => (
          <div key={index} className={styles.cardSkeleton}>
            <div className={styles.cardSkeletonImage} />
            <div className={styles.cardSkeletonContent}>
              <div className={styles.cardSkeletonTitle} />
              <div className={styles.cardSkeletonText} />
              <div className={clsx(styles.cardSkeletonText, styles.short)} />
            </div>
          </div>
        ))}
    </>
  );
};

// List Skeleton 组件
export interface ListSkeletonProps {
  count?: number;
  showAvatar?: boolean;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  count = 3,
  showAvatar = true,
}) => {
  return (
    <div className={styles.listSkeleton}>
      {Array(count)
        .fill(0)
        .map((_, index) => (
          <div key={index} className={styles.listSkeletonItem}>
            {showAvatar && <div className={styles.listSkeletonAvatar} />}
            <div className={styles.listSkeletonContent}>
              <div className={styles.listSkeletonTitle} />
              <div className={styles.listSkeletonText} />
            </div>
          </div>
        ))}
    </div>
  );
};

export default Loading;
