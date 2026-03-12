import type { Meta, StoryObj } from '@storybook/react';
import { Dashboard } from './Dashboard';
import type { DashboardStats, RecentOrder, TopProduct } from './Dashboard';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const mockStats: DashboardStats = {
  totalUsers: 12345,
  newUsersToday: 128,
  userGrowth: 12.5,
  totalOrders: 8765,
  ordersToday: 256,
  orderGrowth: 8.3,
  revenue: 1234567,
  revenueToday: 89432,
  revenueGrowth: 23.1,
  totalProducts: 456,
  activeProducts: 312,
  productGrowth: 5.2,
};

const mockOrders: RecentOrder[] = [
  {
    id: '1',
    orderNo: 'ORD20260130001',
    productName: '袋鼠岛一日游',
    productNameEn: 'Kangaroo Island Day Tour',
    customerName: '张三',
    amount: 1298,
    status: 'pending',
    createdAt: '2026-01-30 14:30',
  },
  {
    id: '2',
    orderNo: 'ORD20260130002',
    productName: '巴罗萨谷酒庄之旅',
    productNameEn: 'Barossa Valley Wine Tour',
    customerName: '李四',
    amount: 898,
    status: 'confirmed',
    createdAt: '2026-01-30 13:20',
  },
  {
    id: '3',
    orderNo: 'ORD20260130003',
    productName: '阿德莱德城市观光',
    productNameEn: 'Adelaide City Tour',
    customerName: '王五',
    amount: 398,
    status: 'completed',
    createdAt: '2026-01-30 11:45',
  },
  {
    id: '4',
    orderNo: 'ORD20260130004',
    productName: '海豚巡航体验',
    productNameEn: 'Dolphin Cruise Experience',
    customerName: '赵六',
    amount: 598,
    status: 'cancelled',
    createdAt: '2026-01-30 10:15',
  },
  {
    id: '5',
    orderNo: 'ORD20260130005',
    productName: '弗林德斯山脉探险',
    productNameEn: 'Flinders Ranges Adventure',
    customerName: '钱七',
    amount: 1598,
    status: 'pending',
    createdAt: '2026-01-30 09:00',
  },
];

const mockProducts: TopProduct[] = [
  {
    id: '1',
    name: '袋鼠岛一日游',
    nameEn: 'Kangaroo Island Day Tour',
    image: 'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=200&h=200&fit=crop',
    sales: 1256,
    revenue: 1630088,
    rating: 4.9,
  },
  {
    id: '2',
    name: '巴罗萨谷酒庄之旅',
    nameEn: 'Barossa Valley Wine Tour',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop',
    sales: 892,
    revenue: 801316,
    rating: 4.8,
  },
  {
    id: '3',
    name: '阿德莱德城市观光',
    nameEn: 'Adelaide City Tour',
    image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=200&h=200&fit=crop',
    sales: 756,
    revenue: 300888,
    rating: 4.7,
  },
  {
    id: '4',
    name: '海豚巡航体验',
    nameEn: 'Dolphin Cruise Experience',
    sales: 543,
    revenue: 324714,
    rating: 4.8,
  },
  {
    id: '5',
    name: '弗林德斯山脉探险',
    nameEn: 'Flinders Ranges Adventure',
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=200&h=200&fit=crop',
    sales: 234,
    revenue: 374166,
    rating: 4.6,
  },
];

const meta: Meta<typeof Dashboard> = {
  title: 'Components/Admin/Dashboard',
  component: Dashboard,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '管理后台仪表盘组件，展示核心数据统计、最近订单和热门产品。',
      },
    },
    backgrounds: {
      default: 'gray',
      values: [
        { name: 'gray', value: '#f7fafc' },
        { name: 'white', value: '#ffffff' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  argTypes: {
    language: {
      control: 'radio',
      options: ['zh', 'en'],
      description: '语言',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dashboard>;

/** 完整仪表盘 */
export const Default: Story = {
  args: {
    stats: mockStats,
    recentOrders: mockOrders,
    topProducts: mockProducts,
    onViewOrder: (order) => console.log('View order:', order),
    onViewProduct: (product) => console.log('View product:', product),
    onViewAllOrders: () => console.log('View all orders'),
    onViewAllProducts: () => console.log('View all products'),
  },
};

/** 加载中 */
export const Loading: Story = {
  args: {
    loading: true,
  },
};

/** 空数据 */
export const Empty: Story = {
  args: {
    stats: {
      totalUsers: 0,
      newUsersToday: 0,
      userGrowth: 0,
      totalOrders: 0,
      ordersToday: 0,
      orderGrowth: 0,
      revenue: 0,
      revenueToday: 0,
      revenueGrowth: 0,
      totalProducts: 0,
      activeProducts: 0,
      productGrowth: 0,
    },
    recentOrders: [],
    topProducts: [],
  },
};

/** 仅统计卡片 */
export const StatsOnly: Story = {
  args: {
    stats: mockStats,
    recentOrders: [],
    topProducts: [],
  },
};

/** 负增长数据 */
export const NegativeGrowth: Story = {
  args: {
    stats: {
      ...mockStats,
      userGrowth: -5.2,
      orderGrowth: -12.3,
      revenueGrowth: -8.7,
      productGrowth: -2.1,
    },
    recentOrders: mockOrders,
    topProducts: mockProducts,
  },
};

/** 英文版本 */
export const EnglishVersion: Story = {
  args: {
    ...Default.args,
    language: 'en',
  },
};

/** 少量数据 */
export const FewData: Story = {
  args: {
    stats: mockStats,
    recentOrders: mockOrders.slice(0, 2),
    topProducts: mockProducts.slice(0, 3),
  },
};
