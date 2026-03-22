import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  DollarSign,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Clock,
  Lock,
} from 'lucide-react';
import { LanguageSwitcher } from '../../Common';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext';
import styles from './SupplierLayout.module.css';

interface SupplierLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  key: string;
  path: string;
  icon: React.ReactNode;
  labelKey: string;
  /** If true, only accessible when supplier is approved */
  requireApproved?: boolean;
}

const menuItems: MenuItem[] = [
  { key: 'dashboard', path: '/supplier', icon: <LayoutDashboard size={20} />, labelKey: 'supplier.nav.dashboard' },
  { key: 'products', path: '/supplier/products', icon: <Package size={20} />, labelKey: 'supplier.nav.products', requireApproved: true },
  { key: 'orders', path: '/supplier/orders', icon: <ShoppingCart size={20} />, labelKey: 'supplier.nav.orders', requireApproved: true },
  { key: 'settlement', path: '/supplier/settlement', icon: <DollarSign size={20} />, labelKey: 'supplier.nav.settlement', requireApproved: true },
  { key: 'auditLogs', path: '/supplier/audit-logs', icon: <FileText size={20} />, labelKey: 'supplier.nav.auditLogs' },
  { key: 'settings', path: '/supplier/settings', icon: <Settings size={20} />, labelKey: 'supplier.nav.settings' },
];

export const SupplierLayout: React.FC<SupplierLayoutProps> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { supplier, supplierStatus, logout } = useSupplierAuth();
  const isApproved = supplierStatus === 'approved';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/supplier/login');
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const isActiveRoute = (path: string) => {
    if (path === '/supplier') {
      return location.pathname === '/supplier' || location.pathname === '/supplier/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const getCurrentPageTitle = () => {
    const currentItem = menuItems.find(item => isActiveRoute(item.path));
    return currentItem ? t(currentItem.labelKey) : t('supplier.nav.dashboard');
  };

  const supplierName = supplier?.supplier?.name || supplier?.name || '';

  return (
    <div className={styles.layout}>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''} ${mobileMenuOpen ? styles.mobileOpen : ''}`}
      >
        {/* Sidebar Header */}
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            {!sidebarCollapsed && (
              <>
                <span className={styles.logoText}>EnjoySA</span>
                <span className={styles.logoBadge}>Supplier</span>
              </>
            )}
            {sidebarCollapsed && <span className={styles.logoShort}>ES</span>}
          </div>
          <button
            className={styles.collapseBtn}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Menu size={20} />
          </button>
          <button
            className={styles.mobileCloseBtn}
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {menuItems.map((item) => {
            const locked = item.requireApproved && !isApproved;
            return (
              <button
                key={item.key}
                className={`${styles.navItem} ${isActiveRoute(item.path) ? styles.active : ''} ${locked ? styles.navItemLocked : ''}`}
                onClick={() => {
                  if (locked) return;
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                title={locked
                  ? t('supplier.pending.featureLocked')
                  : sidebarCollapsed ? t(item.labelKey) : undefined}
                disabled={locked}
              >
                <span className={styles.navIcon}>{locked ? <Lock size={20} /> : item.icon}</span>
                {!sidebarCollapsed && (
                  <span className={styles.navLabel}>{t(item.labelKey)}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={20} />
            {!sidebarCollapsed && <span>{t('supplier.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={styles.main}>
        {/* Top Bar */}
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <button
              className={styles.mobileMenuBtn}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className={styles.pageTitle}>{getCurrentPageTitle()}</h1>
          </div>

          <div className={styles.topBarRight}>
            {/* Language Switcher */}
            <LanguageSwitcher
              variant="dropdown"
              size="sm"
              onLanguageChange={handleLanguageChange}
            />

            {/* User Menu */}
            <div className={styles.userMenu}>
              <button
                className={styles.userMenuBtn}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className={styles.userAvatarPlaceholder}>
                  {supplierName.charAt(0) || 'S'}
                </div>
                <span className={styles.userName}>{supplierName || 'Supplier'}</span>
                <ChevronDown size={16} />
              </button>

              {userMenuOpen && (
                <div className={styles.userDropdown}>
                  <div className={styles.userDropdownHeader}>
                    <strong>{supplierName}</strong>
                    <span className={styles.userRole}>{supplier?.supplier?.type || ''}</span>
                  </div>
                  <div className={styles.userDropdownDivider} />
                  <button
                    className={styles.userDropdownItem}
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/supplier/settings');
                    }}
                  >
                    <Settings size={16} />
                    <span>{t('supplier.nav.settings')}</span>
                  </button>
                  <button
                    className={styles.userDropdownItem}
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span>{t('supplier.logout')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Pending Banner */}
        {!isApproved && supplierStatus === 'pending' && (
          <div className={styles.pendingBanner}>
            <Clock size={18} />
            <span>{t('supplier.pending.banner')}</span>
          </div>
        )}

        {/* Page Content */}
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default SupplierLayout;
