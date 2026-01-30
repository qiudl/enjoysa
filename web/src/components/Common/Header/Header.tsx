import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X, ShoppingCart, Heart, User, Search } from 'lucide-react';
import clsx from 'clsx';
import styles from './Header.module.css';
import { LanguageSwitcher } from '../LanguageSwitcher';

export interface HeaderProps {
  /** Logo 图片 URL */
  logo?: string;
  /** 是否已登录 */
  isLoggedIn?: boolean;
  /** 用户名 */
  userName?: string;
  /** 用户头像 */
  userAvatar?: string;
  /** 购物车数量 */
  cartCount?: number;
  /** 收藏数量 */
  favoriteCount?: number;
  /** 是否固定在顶部 */
  sticky?: boolean;
  /** 导航项点击回调 */
  onNavClick?: (path: string) => void;
  /** 登录点击回调 */
  onLoginClick?: () => void;
  /** 注册点击回调 */
  onRegisterClick?: () => void;
  /** 搜索回调 */
  onSearch?: (keyword: string) => void;
}

const navItems = [
  { key: 'home', path: '/' },
  { key: 'destinations', path: '/destinations' },
  { key: 'categories', path: '/categories' },
  { key: 'about', path: '/about' },
  { key: 'contact', path: '/contact' },
];

export const Header: React.FC<HeaderProps> = ({
  logo,
  isLoggedIn = false,
  userName,
  userAvatar,
  cartCount = 0,
  favoriteCount = 0,
  sticky = false,
  onNavClick,
  onLoginClick,
  onRegisterClick,
  onSearch,
}) => {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchKeyword.trim()) {
      onSearch?.(searchKeyword.trim());
      setSearchKeyword('');
      setSearchOpen(false);
    }
  };

  return (
    <header className={clsx(styles.header, sticky && styles.sticky)}>
      <div className={styles.container}>
        {/* Logo */}
        <div className={styles.logo} onClick={() => onNavClick?.('/')}>
          {logo ? (
            <img src={logo} alt="EnjoySA" className={styles.logoImage} />
          ) : (
            <span className={styles.logoText}>EnjoySA</span>
          )}
        </div>

        {/* Desktop Navigation */}
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={styles.navItem}
              onClick={() => onNavClick?.(item.path)}
            >
              {t(`nav.${item.key}`)}
            </button>
          ))}
        </nav>

        {/* Right Actions */}
        <div className={styles.actions}>
          {/* Search Button */}
          <button
            className={styles.iconButton}
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label={t('common.search')}
          >
            <Search size={20} />
          </button>

          {/* Language Switcher */}
          <LanguageSwitcher variant="dropdown" size="sm" />

          {/* Cart - Always visible */}
          <button
            className={styles.iconButton}
            onClick={() => onNavClick?.('/cart')}
            aria-label={t('nav.cart')}
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className={styles.badge}>{cartCount}</span>
            )}
          </button>

          {isLoggedIn ? (
            <>
              {/* Favorites */}
              <button
                className={styles.iconButton}
                onClick={() => onNavClick?.('/favorites')}
                aria-label={t('nav.favorites')}
              >
                <Heart size={20} />
                {favoriteCount > 0 && (
                  <span className={styles.badge}>{favoriteCount}</span>
                )}
              </button>

              {/* User Menu */}
              <button
                className={styles.userButton}
                onClick={() => onNavClick?.('/profile')}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt={userName} className={styles.avatar} />
                ) : (
                  <User size={20} />
                )}
                <span className={styles.userName}>{userName || t('nav.profile')}</span>
              </button>
            </>
          ) : (
            <div className={styles.authButtons}>
              <button className={styles.loginButton} onClick={onLoginClick}>
                {t('auth.login')}
              </button>
              <button className={styles.registerButton} onClick={onRegisterClick}>
                {t('auth.register')}
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className={styles.mobileMenuToggle}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {searchOpen && (
        <div className={styles.searchBar}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder={t('search.placeholder')}
              className={styles.searchInput}
              autoFocus
            />
            <button type="submit" className={styles.searchSubmit}>
              <Search size={18} />
            </button>
          </form>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav className={styles.mobileMenu}>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={styles.mobileNavItem}
              onClick={() => {
                onNavClick?.(item.path);
                setMobileMenuOpen(false);
              }}
            >
              {t(`nav.${item.key}`)}
            </button>
          ))}

          {/* Cart - Always visible */}
          <button
            className={styles.mobileNavItem}
            onClick={() => {
              onNavClick?.('/cart');
              setMobileMenuOpen(false);
            }}
          >
            <ShoppingCart size={18} />
            {t('nav.cart')}
            {cartCount > 0 && <span className={styles.mobileBadge}>{cartCount}</span>}
          </button>

          {isLoggedIn ? (
            <>
              <button
                className={styles.mobileNavItem}
                onClick={() => {
                  onNavClick?.('/favorites');
                  setMobileMenuOpen(false);
                }}
              >
                <Heart size={18} />
                {t('nav.favorites')}
                {favoriteCount > 0 && <span className={styles.mobileBadge}>{favoriteCount}</span>}
              </button>
              <button
                className={styles.mobileNavItem}
                onClick={() => {
                  onNavClick?.('/orders');
                  setMobileMenuOpen(false);
                }}
              >
                {t('nav.orders')}
              </button>
              <button
                className={styles.mobileNavItem}
                onClick={() => {
                  onNavClick?.('/profile');
                  setMobileMenuOpen(false);
                }}
              >
                <User size={18} />
                {t('nav.profile')}
              </button>
            </>
          ) : (
            <div className={styles.mobileAuthButtons}>
              <button
                className={styles.mobileLoginButton}
                onClick={() => {
                  onLoginClick?.();
                  setMobileMenuOpen(false);
                }}
              >
                {t('auth.login')}
              </button>
              <button
                className={styles.mobileRegisterButton}
                onClick={() => {
                  onRegisterClick?.();
                  setMobileMenuOpen(false);
                }}
              >
                {t('auth.register')}
              </button>
            </div>
          )}

          <div className={styles.mobileLanguage}>
            <LanguageSwitcher variant="buttons" size="sm" />
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
