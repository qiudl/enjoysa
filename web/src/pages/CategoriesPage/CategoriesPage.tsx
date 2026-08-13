import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BedDouble, Binoculars, Wine, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Footer, Header } from '../../components/Common';
import type { ProductCategory } from '../../types';
import { regionService } from '../../services/regionService';
import styles from './CategoriesPage.module.css';

export interface CategoriesPageProps {
  isLoggedIn?: boolean;
  userName?: string;
  userAvatar?: string;
  cartCount?: number;
  onCategoryClick?: (category: ProductCategory) => void;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onSearch?: (keyword: string) => void;
}

type CategoryPresentation = {
  image: string;
  kickerZh: string;
  kickerEn: string;
  descriptionZh: string;
  descriptionEn: string;
  Icon: LucideIcon;
};

const categoryPresentations: Record<string, CategoryPresentation> = {
  attractions: {
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=86',
    kickerZh: '自然 · 文化 · 探险',
    kickerEn: 'NATURE · CULTURE · ADVENTURE',
    descriptionZh: '深入海岸、野生动物与城市文化，发现只属于南澳的精彩。',
    descriptionEn: 'Follow dramatic coastlines, wildlife encounters and city culture into the heart of South Australia.',
    Icon: Binoculars,
  },
  'food-wine': {
    image: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1400&q=86',
    kickerZh: '餐桌 · 酒庄 · 风土',
    kickerEn: 'TABLE · VINEYARD · TERROIR',
    descriptionZh: '从世界级酒庄到海岸餐桌，用味蕾读懂南澳的风土。',
    descriptionEn: 'Taste the landscape through celebrated cellar doors, coastal tables and local produce.',
    Icon: Wine,
  },
  accommodation: {
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=86',
    kickerZh: '设计 · 私密 · 慢住',
    kickerEn: 'DESIGN · PRIVACY · RETREAT',
    descriptionZh: '住进风景里，精选酒庄居所、海岛度假屋与城市精品酒店。',
    descriptionEn: 'Stay inside the landscape at vineyard retreats, island hideaways and design-led city hotels.',
    Icon: BedDouble,
  },
};

const fallbackPresentation = categoryPresentations.attractions;

export const CategoriesPage: React.FC<CategoriesPageProps> = ({
  isLoggedIn = false,
  userName,
  userAvatar,
  cartCount = 0,
  onCategoryClick,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onSearch,
}) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');
  const [categories, setCategories] = useState<(ProductCategory & { productCount?: number })[]>([]);

  useEffect(() => {
    regionService.getCategories().then((cats) => {
      setCategories(cats.map((category) => ({
        id: category.id,
        name: category.name,
        nameEn: category.nameEn,
        icon: category.icon,
        productCount: category.productCount,
      })));
    }).catch(() => {});
  }, []);

  return (
    <div className={styles.page}>
      <Header
        isLoggedIn={isLoggedIn}
        userName={userName}
        userAvatar={userAvatar}
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
        onSearch={onSearch}
      />

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroEyebrow}>{isZh ? '南澳精选体验' : 'CURATED SOUTH AUSTRALIA'}</span>
          <h1>{isZh ? '你想如何遇见南澳？' : 'How will you meet South Australia?'}</h1>
          <p>{isZh ? '从令人心跳的户外探险，到值得慢慢品味的餐桌与住宿，选择你的旅行方式。' : 'Choose your way to travel, from wild landscapes to memorable tables and remarkable places to stay.'}</p>
        </div>
        <div className={styles.heroIndex} aria-hidden="true">03</div>
      </section>

      <main className={styles.main}>
        <div className={styles.intro}>
          <div>
            <span className={styles.sectionKicker}>{isZh ? '按兴趣出发' : 'TRAVEL BY INTEREST'}</span>
            <h2>{isZh ? '三种方式，玩转南澳' : 'Three ways to experience the south'}</h2>
          </div>
          <p>{isZh ? '我们将南澳最值得期待的体验整理成三大主题，让每一次选择都更简单。' : 'We have gathered the best of South Australia into three distinct collections, making inspiration easy to find.'}</p>
        </div>

        <section className={styles.categoriesGrid} aria-label={isZh ? '产品分类' : 'Product categories'}>
          {categories.map((category, index) => {
            const presentation = categoryPresentations[category.id] || fallbackPresentation;
            const { Icon } = presentation;
            const name = isZh ? category.name : category.nameEn;

            return (
              <article
                key={category.id}
                className={styles.categoryCard}
                data-testid={`category-card-${category.id}`}
                role="button"
                tabIndex={0}
                onClick={() => onCategoryClick?.(category)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onCategoryClick?.(category);
                }}
              >
                <img src={presentation.image} alt={`${name} - 南澳`} loading={index === 0 ? 'eager' : 'lazy'} />
                <div className={styles.imageShade} />
                <div className={styles.cardTopline}>
                  <span>0{index + 1}</span>
                  <span className={styles.icon}><Icon size={20} strokeWidth={1.7} /></span>
                </div>
                <div className={styles.cardContent}>
                  <span className={styles.cardKicker}>{isZh ? presentation.kickerZh : presentation.kickerEn}</span>
                  <h3>{name}</h3>
                  <p>{isZh ? presentation.descriptionZh : presentation.descriptionEn}</p>
                  <div className={styles.cardAction}>
                    <span>{category.productCount || 0} {isZh ? '项精选产品' : 'curated products'}</span>
                    <span className={styles.arrow}><ArrowUpRight size={22} /></span>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CategoriesPage;
