import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  Button,
} from '../../components/Common';
import styles from './FavoritesPage.module.css';

export interface FavoritesPageProps {
  isLoggedIn?: boolean;
  userName?: string;
  userAvatar?: string;
  /** 购物车数量 */
  cartCount?: number;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onSearch?: (keyword: string) => void;
  onExplore?: () => void;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({
  isLoggedIn = false,
  userName,
  userAvatar,
  cartCount = 0,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onSearch,
  onExplore,
}) => {
  const { t } = useTranslation();

  const favorites: unknown[] = [];

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

      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>{t('nav.favorites')}</h1>

          {favorites.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>❤️</span>
              <h2>{t('user.favoritesEmpty')}</h2>
              <p>{t('user.favoritesEmptyHint')}</p>
              <Button variant="primary" onClick={onExplore}>
                {t('user.explore')}
              </Button>
            </div>
          ) : (
            <div className={styles.grid}>
              {/* Favorite items would be rendered here */}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FavoritesPage;
