import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
} from '../../components/Common';
import { CategoryCard } from '../../components/Category';
import type { ProductCategory } from '../../types';
import { regionService } from '../../services/regionService';
import styles from './CategoriesPage.module.css';

export interface CategoriesPageProps {
  /** 是否登录 */
  isLoggedIn?: boolean;
  /** 用户名 */
  userName?: string;
  /** 用户头像 */
  userAvatar?: string;
  /** 购物车数量 */
  cartCount?: number;
  /** 分类点击 */
  onCategoryClick?: (category: ProductCategory) => void;
  /** 登录点击 */
  onLoginClick?: () => void;
  /** 注册点击 */
  onRegisterClick?: () => void;
  /** 导航点击 */
  onNavClick?: (path: string) => void;
  /** 搜索 */
  onSearch?: (keyword: string) => void;
}

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
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';
  const [categories, setCategories] = useState<(ProductCategory & { productCount?: number })[]>([]);

  useEffect(() => {
    regionService.getCategories().then((cats) => {
      setCategories(cats.map((c) => ({
        id: c.id,
        name: c.name,
        nameEn: c.nameEn,
        icon: c.icon,
        productCount: c.productCount,
      })));
    }).catch(() => {});
  }, []);

  // Split categories: first 6 are popular, rest are more
  const popularCategories = categories.slice(0, 6);
  const moreCategories = categories.slice(6);

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

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{t('category.title')}</h1>
          <p className={styles.heroSubtitle}>{t('category.subtitle')}</p>
        </div>
      </section>

      {/* Categories Grid */}
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Popular Categories */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('category.popularCategories')}</h2>
            <div className={styles.categoriesGrid}>
              {popularCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  productCount={category.productCount || 0}
                  icon={category.icon}
                  language={currentLang}
                  onClick={onCategoryClick}
                />
              ))}
            </div>
          </section>

          {/* More Categories */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('category.moreCategories')}</h2>
            <div className={styles.categoriesGrid}>
              {moreCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  productCount={category.productCount || 0}
                  icon={category.icon}
                  language={currentLang}
                  onClick={onCategoryClick}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CategoriesPage;
