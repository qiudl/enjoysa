import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminService } from '../../../services/adminService';
import {
  LayoutDashboard,
  Building2,
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Image,
  MapPin,
  Tag,
  Home,
  BarChart3,
  Bot,
} from 'lucide-react';
import { LanguageSwitcher } from '../../Common';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { AIPanel, type ToolCategory } from '../../AI/AIPanel';
import styles from './AdminLayout.module.css';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  key: string;
  path: string;
  icon: React.ReactNode;
  labelKey: string;
  permission?: string;
}

const menuItems: MenuItem[] = [
  { key: 'dashboard', path: '/admin', icon: <LayoutDashboard size={20} />, labelKey: 'admin.menu.dashboard' },
  { key: 'suppliers', path: '/admin/suppliers', icon: <Building2 size={20} />, labelKey: 'admin.menu.suppliers', permission: 'suppliers.view' },
  { key: 'products', path: '/admin/products', icon: <Package size={20} />, labelKey: 'admin.menu.products', permission: 'products.view' },
  { key: 'orders', path: '/admin/orders', icon: <ShoppingCart size={20} />, labelKey: 'admin.menu.orders', permission: 'orders.view' },
  { key: 'users', path: '/admin/users', icon: <Users size={20} />, labelKey: 'admin.menu.users', permission: 'users.view' },
  { key: 'finance', path: '/admin/finance', icon: <DollarSign size={20} />, labelKey: 'admin.menu.finance', permission: 'finance.view' },
  { key: 'admins', path: '/admin/admins', icon: <Shield size={20} />, labelKey: 'admin.menu.admins', permission: 'admins.view' },
  { key: 'banners', path: '/admin/banners', icon: <Image size={20} />, labelKey: 'admin.menu.banners' },
  { key: 'regions', path: '/admin/regions', icon: <MapPin size={20} />, labelKey: 'admin.menu.regions' },
  { key: 'categories', path: '/admin/categories', icon: <Tag size={20} />, labelKey: 'admin.menu.categories' },
  { key: 'homepage', path: '/admin/homepage', icon: <Home size={20} />, labelKey: 'admin.menu.homepage' },
  { key: 'settings', path: '/admin/settings', icon: <Settings size={20} />, labelKey: 'admin.menu.settings', permission: 'settings.view' },
  { key: 'ai-chat-test', path: '/admin/ai-chat-test', icon: <Bot size={20} />, labelKey: 'admin.menu.aiChatTest', permission: 'admins.view' },
];

const adminToolCategories: ToolCategory[] = [
  {
    id: 'analytics',
    name: '运营分析',
    icon: <BarChart3 size={12} />,
    iconBg: '#e8f4ff',
    iconColor: '#1677ff',
    tools: [
      { id: 'get_platform_stats', icon: <BarChart3 size={16} />, iconBg: '#e8f4ff', iconColor: '#1677ff', name: '平台 AI 洞察', description: '总用户/供应商/商品/订单/收入概览', enabled: true, pinned: true },
      { id: 'search_suppliers', icon: <BarChart3 size={16} />, iconBg: '#e8f4ff', iconColor: '#1677ff', name: '搜索供应商', description: '按名称/状态搜索供应商及统计', enabled: true },
    ],
  },
  {
    id: 'quality',
    name: '商品管控',
    icon: <Shield size={12} />,
    iconBg: '#fff1f0',
    iconColor: '#f5222d',
    tools: [
      { id: 'list_pending_products', icon: <Shield size={16} />, iconBg: '#fff1f0', iconColor: '#f5222d', name: '待审核商品', description: '查看等待审核的商品列表', enabled: true },
      { id: 'approve_product', icon: <Shield size={16} />, iconBg: '#f6ffed', iconColor: '#52c41a', name: '审核通过', description: '审核通过指定商品（pending→approved）', enabled: true },
      { id: 'offline_product', icon: <Shield size={16} />, iconBg: '#fff1f0', iconColor: '#f5222d', name: '下架商品', description: '下架指定商品（需填写原因）', enabled: true },
    ],
  },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, logout, hasPermission } = useAdminAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // REQ-20260509-0019: pending counts powering the Products nav badge.
  // 5min poll keeps DB pressure trivial (single COUNT WHERE status=...);
  // dropping a count badge to zero auto-clears next tick. Failed lookups
  // leave the badge stale rather than removing it — better than misleading.
  const [pendingProducts, setPendingProducts] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fetchCounts = async () => {
      try {
        const r = await adminService.getPendingCounts();
        if (!cancelled) setPendingProducts(r.products ?? 0);
      } catch {
        // leave stale; admin will see updated value when next poll succeeds
      }
    };
    fetchCounts();
    const id = window.setInterval(fetchCounts, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const isActiveRoute = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const filteredMenuItems = menuItems.filter(
    item => !item.permission || hasPermission(item.permission)
  );

  const getCurrentPageTitle = () => {
    const currentItem = menuItems.find(item => isActiveRoute(item.path));
    return currentItem ? t(currentItem.labelKey) : t('admin.menu.dashboard');
  };

  // REQ-20260509-0026: 把 sidebar 当前宽度暴露给 AIPanel 的 left dock，
  // 让 AI 面板紧贴 sidebar 右侧而不是被压在底下。
  const sidebarWidthVar = sidebarCollapsed ? '72px' : '260px';

  return (
    <div
      className={styles.layout}
      style={{ '--app-sidebar-width': sidebarWidthVar } as React.CSSProperties}
    >
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
                <span className={styles.logoAdmin}>Admin</span>
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
          {filteredMenuItems.map((item) => {
            const showBadge = item.key === 'products' && pendingProducts !== null && pendingProducts > 0;
            return (
              <button
                key={item.key}
                className={`${styles.navItem} ${isActiveRoute(item.path) ? styles.active : ''}`}
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                title={sidebarCollapsed ? t(item.labelKey) : undefined}
              >
                <span className={styles.navIcon}>
                  {item.icon}
                  {showBadge && (
                    <span
                      className={styles.navIconBadge}
                      title={t('admin.menu.pendingReview', {
                        defaultValue: '{{count}} awaiting review',
                        count: pendingProducts,
                      })}
                    >
                      {pendingProducts! > 99 ? '99+' : pendingProducts}
                    </span>
                  )}
                </span>
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
            {!sidebarCollapsed && <span>{t('admin.logout')}</span>}
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
            {/* Notifications */}
            <button className={styles.notificationBtn}>
              <Bell size={20} />
              <span className={styles.notificationBadge}>3</span>
            </button>

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
                {admin?.avatar ? (
                  <img src={admin.avatar} alt="" className={styles.userAvatar} />
                ) : (
                  <div className={styles.userAvatarPlaceholder}>
                    {admin?.name?.charAt(0) || 'A'}
                  </div>
                )}
                <span className={styles.userName}>{admin?.name || 'Admin'}</span>
                <ChevronDown size={16} />
              </button>

              {userMenuOpen && (
                <div className={styles.userDropdown}>
                  <div className={styles.userDropdownHeader}>
                    <strong>{admin?.name}</strong>
                    <span className={styles.userRole}>
                      {admin?.roles && admin.roles.length > 0
                        ? admin.roles.map(r => r.name).join(', ')
                        : admin?.role === 'super_admin' ? t('admin.roles.superAdmin') : t('admin.roles.admin')}
                    </span>
                  </div>
                  <div className={styles.userDropdownDivider} />
                  <button
                    className={styles.userDropdownItem}
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/admin/settings');
                    }}
                  >
                    <Settings size={16} />
                    <span>{t('admin.menu.settings')}</span>
                  </button>
                  <button
                    className={styles.userDropdownItem}
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span>{t('admin.logout')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={styles.content}>
          {children}
        </main>
      </div>

      {/* AI Panel */}
      <AIPanel
        role="admin"
        toolCategories={adminToolCategories}
      />
    </div>
  );
};

export default AdminLayout;
