import type { Meta, StoryObj } from '@storybook/react';
import { SupplierList } from './SupplierList';
import type { Supplier } from '../SupplierCard';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const mockSuppliers: Supplier[] = [
  {
    id: '1',
    name: '南澳探险旅行社',
    nameEn: 'SA Adventure Tours',
    logo: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&h=200&fit=crop',
    location: '阿德莱德市中心',
    locationEn: 'Adelaide CBD',
    rating: 4.8,
    reviewCount: 256,
    productCount: 15,
    status: 'active',
    verifiedAt: '2025-06-15',
    description: '专业从事南澳大利亚生态旅游和野生动物观光，提供袋鼠岛、巴罗莎谷等热门线路。',
    descriptionEn: 'Specializing in South Australian eco-tourism and wildlife tours.',
    tags: ['生态旅游', '野生动物', '酒庄游'],
  },
  {
    id: '2',
    name: '澳洲美食之旅',
    nameEn: 'Aussie Food Tours',
    location: '格雷尔海滩',
    locationEn: 'Glenelg',
    rating: 4.6,
    reviewCount: 128,
    productCount: 8,
    status: 'active',
    description: '带您探索阿德莱德最地道的美食体验。',
    tags: ['美食', '本地体验'],
  },
  {
    id: '3',
    name: '海洋探索公司',
    nameEn: 'Ocean Discovery Co.',
    logo: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&h=200&fit=crop',
    location: '维克多港',
    locationEn: 'Victor Harbor',
    rating: 4.9,
    reviewCount: 89,
    productCount: 6,
    status: 'pending',
    description: '专业的海洋生态旅游，提供海豚巡航、观鲸等体验。',
    tags: ['海洋生态', '观鲸', '海豚'],
  },
  {
    id: '4',
    name: '经典酒庄游',
    nameEn: 'Classic Winery Tours',
    location: '巴罗莎谷',
    locationEn: 'Barossa Valley',
    rating: 4.3,
    reviewCount: 45,
    productCount: 4,
    status: 'suspended',
    description: '带您深度游览巴罗莎谷的顶级酒庄。',
  },
  {
    id: '5',
    name: '阿德莱德城市观光',
    nameEn: 'Adelaide City Tours',
    logo: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop',
    location: '阿德莱德',
    locationEn: 'Adelaide',
    rating: 4.7,
    reviewCount: 312,
    productCount: 12,
    status: 'active',
    description: '探索阿德莱德城市魅力，包括博物馆、画廊和历史建筑。',
    tags: ['城市游', '文化', '历史'],
  },
  {
    id: '6',
    name: '弗林德斯山脉探险',
    nameEn: 'Flinders Ranges Adventure',
    location: '弗林德斯山脉',
    locationEn: 'Flinders Ranges',
    rating: 4.5,
    reviewCount: 67,
    productCount: 5,
    status: 'active',
    description: '体验南澳最壮观的内陆风光。',
    tags: ['探险', '自然', '露营'],
  },
];

const meta: Meta<typeof SupplierList> = {
  title: 'Components/Supplier/SupplierList',
  component: SupplierList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: '供应商列表组件，支持搜索、筛选、排序和多种视图模式。',
      },
    },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  argTypes: {
    viewMode: {
      control: 'radio',
      options: ['grid', 'list'],
      description: '视图模式',
    },
    statusFilter: {
      control: 'select',
      options: ['all', 'active', 'pending', 'suspended'],
      description: '状态筛选',
    },
    sortBy: {
      control: 'select',
      options: ['rating', 'products', 'reviews', 'name'],
      description: '排序方式',
    },
    language: {
      control: 'radio',
      options: ['zh', 'en'],
      description: '语言',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SupplierList>;

/** 默认 - 网格视图 */
export const Default: Story = {
  args: {
    suppliers: mockSuppliers,
    viewMode: 'grid',
    statusFilter: 'all',
    sortBy: 'rating',
    onSupplierClick: (supplier) => console.log('Clicked:', supplier.name),
    onViewProducts: (supplier) => console.log('View products:', supplier.name),
    onViewModeChange: (mode) => console.log('View mode:', mode),
    onStatusFilterChange: (status) => console.log('Status filter:', status),
    onSortChange: (sort) => console.log('Sort by:', sort),
    onSearch: (keyword) => console.log('Search:', keyword),
  },
};

/** 列表视图 */
export const ListView: Story = {
  args: {
    ...Default.args,
    viewMode: 'list',
  },
};

/** 已认证供应商 */
export const ActiveOnly: Story = {
  args: {
    ...Default.args,
    statusFilter: 'active',
  },
};

/** 审核中供应商 */
export const PendingOnly: Story = {
  args: {
    ...Default.args,
    statusFilter: 'pending',
  },
};

/** 按产品数量排序 */
export const SortByProducts: Story = {
  args: {
    ...Default.args,
    sortBy: 'products',
  },
};

/** 加载中 */
export const Loading: Story = {
  args: {
    suppliers: [],
    loading: true,
  },
};

/** 空状态 */
export const Empty: Story = {
  args: {
    suppliers: [],
    emptyText: '暂无供应商数据',
  },
};

/** 搜索无结果 */
export const NoSearchResults: Story = {
  args: {
    suppliers: mockSuppliers,
    searchKeyword: 'xyz不存在的供应商',
  },
};

/** 隐藏工具栏 */
export const NoToolbar: Story = {
  args: {
    suppliers: mockSuppliers,
    showSearch: false,
    showFilters: false,
  },
};

/** 仅搜索 */
export const SearchOnly: Story = {
  args: {
    suppliers: mockSuppliers,
    showSearch: true,
    showFilters: false,
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
export const FewSuppliers: Story = {
  args: {
    suppliers: mockSuppliers.slice(0, 2),
  },
};
