import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setSupplierLocale } from '../../../i18n';
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
  MessageSquare,
  Download,
  Users,
  Headphones,
  BarChart3,
  Sparkles,
  ClipboardList,
} from 'lucide-react';
import { LanguageSwitcher } from '../../Common';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext';
import { BookmarkPanel } from '../BookmarkPanel/BookmarkPanel';
import { NotificationPanel } from '../NotificationPanel/NotificationPanel';
import { ShopPreviewModal } from '../ShopPreviewModal/ShopPreviewModal';
import { AIPanel, type ToolCategory } from '../../AI/AIPanel';
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
  { key: 'reviews', path: '/supplier/reviews', icon: <MessageSquare size={20} />, labelKey: 'supplier.nav.reviews', requireApproved: true },
  { key: 'settlement', path: '/supplier/settlement', icon: <DollarSign size={20} />, labelKey: 'supplier.nav.settlement', requireApproved: true },
  { key: 'exports', path: '/supplier/exports', icon: <Download size={20} />, labelKey: 'supplier.nav.exports', requireApproved: true },
  { key: 'team', path: '/supplier/team', icon: <Users size={20} />, labelKey: 'supplier.nav.team', requireApproved: true },
  { key: 'afterSales', path: '/supplier/after-sales', icon: <Headphones size={20} />, labelKey: 'supplier.nav.afterSales', requireApproved: true },
  { key: 'reports', path: '/supplier/reports', icon: <BarChart3 size={20} />, labelKey: 'supplier.nav.reports', requireApproved: true },
  { key: 'auditLogs', path: '/supplier/audit-logs', icon: <FileText size={20} />, labelKey: 'supplier.nav.auditLogs' },
  { key: 'settings', path: '/supplier/settings', icon: <Settings size={20} />, labelKey: 'supplier.nav.settings' },
];

const supplierToolCategories: ToolCategory[] = [
  {
    id: 'analytics',
    name: '运营分析',
    icon: <BarChart3 size={12} />,
    iconBg: '#e8f4ff',
    iconColor: '#1677ff',
    tools: [
      { id: 'get_order_stats', icon: <BarChart3 size={16} />, iconBg: '#e8f4ff', iconColor: '#1677ff', name: 'AI 订单统计', description: '今日/本周/本月订单数、收入、取消率', enabled: true, pinned: true },
      { id: 'get_revenue_trend', icon: <BarChart3 size={16} />, iconBg: '#e8f4ff', iconColor: '#1677ff', name: 'AI 收入趋势', description: '最近N天每日收入和订单量趋势', enabled: true },
      { id: 'get_review_stats', icon: <MessageSquare size={16} />, iconBg: '#fff7e6', iconColor: '#fa8c16', name: 'AI 评价统计', description: '评分分布、回复率、平均评分', enabled: true },
    ],
  },
  {
    id: 'orders',
    name: '订单管理',
    icon: <ShoppingCart size={12} />,
    iconBg: '#f6ffed',
    iconColor: '#52c41a',
    tools: [
      { id: 'list_pending_orders', icon: <ShoppingCart size={16} />, iconBg: '#f6ffed', iconColor: '#52c41a', name: 'AI 待确认订单', description: '查看等待确认的订单列表', enabled: true },
      { id: 'confirm_order', icon: <ShoppingCart size={16} />, iconBg: '#f6ffed', iconColor: '#52c41a', name: 'AI 确认订单', description: '确认指定订单（paid→accepted）', enabled: true },
      { id: 'search_orders', icon: <ShoppingCart size={16} />, iconBg: '#f6ffed', iconColor: '#52c41a', name: 'AI 搜索订单', description: '按订单号/商品名/日期搜索订单', enabled: true },
    ],
  },
  {
    id: 'inventory',
    name: '库存与结算',
    icon: <Package size={12} />,
    iconBg: '#fff1f0',
    iconColor: '#f5222d',
    tools: [
      { id: 'get_inventory_alerts', icon: <Package size={16} />, iconBg: '#fff1f0', iconColor: '#f5222d', name: 'AI 库存预警', description: '低库存和已售罄排期预警', enabled: true },
      { id: 'get_settlement_detail', icon: <DollarSign size={16} />, iconBg: '#f6ffed', iconColor: '#52c41a', name: 'AI 结算详情', description: '待结算/已结算金额统计', enabled: true },
    ],
  },
  {
    id: 'content',
    name: '内容创作',
    icon: <Sparkles size={12} />,
    iconBg: '#fff7e6',
    iconColor: '#fa8c16',
    tools: [
      { id: 'writer', icon: <Sparkles size={16} />, iconBg: '#fff7e6', iconColor: '#fa8c16', name: 'AI 商品写手', description: '一键生成商品英文名、描述、亮点、FAQ', path: '/supplier/products/new', enabled: true },
    ],
  },
  {
    id: 'service',
    name: '客户服务',
    icon: <Headphones size={12} />,
    iconBg: '#f9f0ff',
    iconColor: '#722ed1',
    tools: [
      { id: 'reply', icon: <MessageSquare size={16} />, iconBg: '#f6ffed', iconColor: '#52c41a', name: 'AI 评论回复', description: '根据评价内容和评分智能生成专业回复', path: '/supplier/reviews', enabled: true },
      { id: 'ticket', icon: <Headphones size={16} />, iconBg: '#f9f0ff', iconColor: '#722ed1', name: 'AI 工单分析', description: '分析售后工单意图，推荐最优处理方案', path: '/supplier/after-sales', enabled: true },
    ],
  },
  {
    id: 'feedback',
    name: '需求反馈',
    icon: <ClipboardList size={12} />,
    iconBg: '#e6f7ff',
    iconColor: '#1890ff',
    tools: [
      { id: 'create_requirement', icon: <ClipboardList size={16} />, iconBg: '#e6f7ff', iconColor: '#1890ff', name: '提交需求/反馈', description: '向平台提交功能建议、Bug 报告或改进意见', enabled: true },
      { id: 'list_requirements', icon: <ClipboardList size={16} />, iconBg: '#e6f7ff', iconColor: '#1890ff', name: '查看我的需求', description: '查看已提交的需求列表和进展状态', enabled: true },
      { id: 'upload_screenshot_requirement', icon: <ClipboardList size={16} />, iconBg: '#fff1f0', iconColor: '#f5222d', name: '截图反馈问题', description: '上传截图并自动创建 Bug 需求', enabled: true },
    ],
  },
];

export const SupplierLayout: React.FC<SupplierLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { supplier, supplierStatus, logout } = useSupplierAuth();
  const isApproved = supplierStatus === 'approved';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // REQ-20260508-0002: lock supplier backend to en-US so suppliers don't get
  // mixed-language UI. Re-apply on every mount because i18n state is shared
  // with the C-side app and the user may have switched there.
  useEffect(() => {
    setSupplierLocale();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/supplier/login');
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
            {/* Shop Preview */}
            {isApproved && <ShopPreviewModal />}

            {/* Bookmarks */}
            <BookmarkPanel />

            {/* Notifications */}
            <NotificationPanel onViewAll={() => navigate('/supplier/notifications')} />

            {/* Language Switcher: hidden in supplier backend per REQ-20260508-0002. */}
            <LanguageSwitcher hidden />

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

      {/* AI Panel */}
      <AIPanel
        role="supplier"
        toolCategories={supplierToolCategories}
        onViewAllNotifications={() => navigate('/supplier/notifications')}
      />
    </div>
  );
};

export default SupplierLayout;
