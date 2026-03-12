import React, { useState } from 'react';
import { LanguageSwitcher } from '../../components/Common';
import { Dashboard } from '../../components/Admin';
import type { RecentOrder, TopProduct } from '../../components/Admin/Dashboard/Dashboard';
import styles from './AdminDashboardPage.module.css';

export interface AdminDashboardPageProps {
  /** 当前语言 */
  language?: 'zh' | 'en';
  /** 管理员名称 */
  adminName?: string;
  /** 管理员头像 */
  adminAvatar?: string;
  /** 加载中 */
  loading?: boolean;
  /** 退出登录 */
  onLogout?: () => void;
  /** 语言切换 */
  onLanguageChange?: (lang: 'zh' | 'en') => void;
}

// Mock dashboard data
const mockStats = {
  totalUsers: 12580,
  newUsersToday: 48,
  userGrowth: 12.5,
  totalOrders: 3850,
  ordersToday: 156,
  orderGrowth: 8.3,
  revenue: 458900,
  revenueToday: 18650,
  revenueGrowth: 15.2,
  totalProducts: 128,
  activeProducts: 98,
  productGrowth: 5.0,
};

const mockRecentOrders: RecentOrder[] = [
  {
    id: '1',
    orderNo: 'ORD-20260215-0001',
    customerName: '张三',
    productName: '袋鼠岛一日游',
    productNameEn: 'Kangaroo Island Day Tour',
    amount: 778,
    status: 'completed',
    createdAt: '2026-02-15 14:30',
  },
  {
    id: '2',
    orderNo: 'ORD-20260215-0002',
    customerName: '李四',
    productName: '巴罗萨谷酒庄之旅',
    productNameEn: 'Barossa Valley Tour',
    amount: 1196,
    status: 'confirmed',
    createdAt: '2026-02-15 13:45',
  },
  {
    id: '3',
    orderNo: 'ORD-20260215-0003',
    customerName: '王五',
    productName: '海豚巡航体验',
    productNameEn: 'Dolphin Cruise',
    amount: 477,
    status: 'pending',
    createdAt: '2026-02-15 12:20',
  },
  {
    id: '4',
    orderNo: 'ORD-20260215-0004',
    customerName: 'John',
    productName: '阿德莱德城市观光',
    productNameEn: 'Adelaide City Tour',
    amount: 258,
    status: 'cancelled',
    createdAt: '2026-02-15 11:15',
  },
  {
    id: '5',
    orderNo: 'ORD-20260215-0005',
    customerName: '赵六',
    productName: '袋鼠岛两日游',
    productNameEn: 'Kangaroo Island 2-Day Tour',
    amount: 1580,
    status: 'completed',
    createdAt: '2026-02-15 10:30',
  },
];

const mockTopProducts: TopProduct[] = [
  {
    id: '1',
    name: '袋鼠岛一日游',
    nameEn: 'Kangaroo Island Day Tour',
    image: 'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=100',
    sales: 326,
    revenue: 126814,
    rating: 4.8,
  },
  {
    id: '2',
    name: '巴罗萨谷酒庄之旅',
    nameEn: 'Barossa Valley Tour',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100',
    sales: 245,
    revenue: 73255,
    rating: 4.9,
  },
  {
    id: '3',
    name: '海豚巡航体验',
    nameEn: 'Dolphin Cruise',
    image: 'https://images.unsplash.com/photo-1540202403-b7abd6747a18?w=100',
    sales: 198,
    revenue: 31482,
    rating: 4.7,
  },
  {
    id: '4',
    name: '阿德莱德城市观光',
    nameEn: 'Adelaide City Tour',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    sales: 156,
    revenue: 20124,
    rating: 4.6,
  },
  {
    id: '5',
    name: '袋鼠岛两日游',
    nameEn: 'Kangaroo Island 2-Day',
    image: 'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=100',
    sales: 89,
    revenue: 70310,
    rating: 4.9,
  },
];

const texts = {
  zh: {
    title: '管理后台',
    dashboard: '控制台',
    products: '产品管理',
    orders: '订单管理',
    users: '用户管理',
    suppliers: '供应商',
    settings: '系统设置',
  },
  en: {
    title: 'Admin Dashboard',
    dashboard: 'Dashboard',
    products: 'Products',
    orders: 'Orders',
    users: 'Users',
    suppliers: 'Suppliers',
    settings: 'Settings',
  },
};

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  language = 'zh',
  adminName = '管理员',
  adminAvatar,
  loading = false,
  onLogout,
  onLanguageChange,
}) => {
  const txt = texts[language];
  const [currentLang, setCurrentLang] = useState(language);
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const handleLanguageChange = (lang: string) => {
    const typedLang = lang as 'zh' | 'en';
    setCurrentLang(typedLang);
    onLanguageChange?.(typedLang);
  };

  const menuItems = [
    { key: 'dashboard', icon: '📊', label: txt.dashboard },
    { key: 'products', icon: '📦', label: txt.products },
    { key: 'orders', icon: '📋', label: txt.orders },
    { key: 'users', icon: '👥', label: txt.users },
    { key: 'suppliers', icon: '🏢', label: txt.suppliers },
    { key: 'settings', icon: '⚙️', label: txt.settings },
  ];

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h1 className={styles.logo}>畅游南澳</h1>
          <span className={styles.adminBadge}>Admin</span>
        </div>

        <nav className={styles.nav}>
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={`${styles.navItem} ${activeMenu === item.key ? styles.activeNavItem : ''}`}
              onClick={() => setActiveMenu(item.key)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.adminInfo}>
            {adminAvatar ? (
              <img src={adminAvatar} alt="" className={styles.adminAvatar} />
            ) : (
              <div className={styles.adminAvatarPlaceholder}>
                {adminName.charAt(0)}
              </div>
            )}
            <span className={styles.adminName}>{adminName}</span>
          </div>
          <button className={styles.logoutBtn} onClick={onLogout}>
            退出
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Top Bar */}
        <header className={styles.topBar}>
          <h2 className={styles.pageTitle}>{txt.title}</h2>
          <div className={styles.topBarActions}>
            <LanguageSwitcher
              variant="dropdown"
              size="sm"
              onLanguageChange={handleLanguageChange}
            />
          </div>
        </header>

        {/* Dashboard Content */}
        <div className={styles.content}>
          <Dashboard
            stats={mockStats}
            recentOrders={mockRecentOrders}
            topProducts={mockTopProducts}
            loading={loading}
            language={currentLang}
          />
        </div>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
