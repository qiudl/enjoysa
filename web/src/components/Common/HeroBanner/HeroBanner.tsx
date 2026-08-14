import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './HeroBanner.module.css';

export interface BannerSlide {
  id: string;
  image: string;
  title: string;
  titleEn: string;
  subtitle?: string;
  subtitleEn?: string;
  tags: string[];
  tagsEn: string[];
  attractionId?: string;
  linkUrl?: string;
}

export interface HeroBannerProps {
  slides: BannerSlide[];
  autoPlayInterval?: number;
  onSlideClick?: (slide: BannerSlide) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  slides,
  autoPlayInterval = 5000,
  onSlideClick,
}) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');
  const [current, setCurrent] = useState(0);

  const goTo = useCallback((index: number) => {
    setCurrent((index + slides.length) % slides.length);
  }, [slides.length]);

  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);
  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(goNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [goNext, autoPlayInterval, slides.length]);

  // Touch swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? goNext() : goPrev();
    }
    setTouchStart(null);
  };

  if (slides.length === 0) return null;

  return (
    <section
      className={styles.banner}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`${styles.slide} ${index === current ? styles.active : ''}`}
          style={{ backgroundImage: `url(${slide.image})` }}
          onClick={() => onSlideClick?.(slide)}
        >
          <div className={styles.overlay} />
          <div className={styles.content}>
            <h2 className={styles.title}>
              {isZh ? slide.title : slide.titleEn}
            </h2>
            {(isZh ? slide.subtitle : slide.subtitleEn) && (
              <p className={styles.subtitle}>
                {isZh ? slide.subtitle : slide.subtitleEn}
              </p>
            )}
            <div className={styles.tags}>
              {(isZh ? slide.tags : slide.tagsEn).map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      ))}

      {slides.length > 1 && (
        <>
          <button className={`${styles.arrow} ${styles.arrowLeft}`} onClick={goPrev}>
            <ChevronLeft size={24} />
          </button>
          <button className={`${styles.arrow} ${styles.arrowRight}`} onClick={goNext}>
            <ChevronRight size={24} />
          </button>
          <div className={styles.dots}>
            {slides.map((_, index) => (
              <button
                key={index}
                className={`${styles.dot} ${index === current ? styles.dotActive : ''}`}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default HeroBanner;
