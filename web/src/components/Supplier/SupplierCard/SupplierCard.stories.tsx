import type { Meta, StoryObj } from '@storybook/react';
import { SupplierCard } from './SupplierCard';
import type { Supplier } from './SupplierCard';
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
    descriptionEn: 'Specializing in South Australian eco-tourism and wildlife tours, offering popular routes including Kangaroo Island and Barossa Valley.',
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
    description: '带您探索阿德莱德最地道的美食体验，从中央市场到海滨餐厅。',
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
];

const meta: Meta<typeof SupplierCard> = {
  title: 'Components/Supplier/SupplierCard',
  component: SupplierCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '供应商卡片组件，用于B2B供应商列表展示。',
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
        <div style={{ width: '360px' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'compact', 'detailed'],
      description: '变体样式',
    },
    language: {
      control: 'radio',
      options: ['zh', 'en'],
      description: '语言',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SupplierCard>;

/** 默认样式 */
export const Default: Story = {
  args: {
    supplier: mockSuppliers[0],
    onClick: (supplier) => console.log('Clicked:', supplier.name),
    onViewProducts: (supplier) => console.log('View products:', supplier.name),
  },
};

/** 无Logo */
export const WithoutLogo: Story = {
  args: {
    supplier: mockSuppliers[1],
    onClick: (supplier) => console.log('Clicked:', supplier.name),
    onViewProducts: (supplier) => console.log('View products:', supplier.name),
  },
};

/** 紧凑样式 */
export const Compact: Story = {
  args: {
    supplier: mockSuppliers[0],
    variant: 'compact',
    onClick: (supplier) => console.log('Clicked:', supplier.name),
  },
};

/** 详情样式 */
export const Detailed: Story = {
  args: {
    supplier: mockSuppliers[0],
    variant: 'detailed',
    onClick: (supplier) => console.log('Clicked:', supplier.name),
    onViewProducts: (supplier) => console.log('View products:', supplier.name),
  },
};

/** 审核中状态 */
export const PendingStatus: Story = {
  args: {
    supplier: mockSuppliers[2],
    onClick: (supplier) => console.log('Clicked:', supplier.name),
    onViewProducts: (supplier) => console.log('View products:', supplier.name),
  },
};

/** 已停用状态 */
export const SuspendedStatus: Story = {
  args: {
    supplier: mockSuppliers[3],
    onClick: (supplier) => console.log('Clicked:', supplier.name),
    onViewProducts: (supplier) => console.log('View products:', supplier.name),
  },
};

/** 供应商列表 */
export const SupplierGrid: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 340px)', gap: '1rem' }}>
      {mockSuppliers.map((supplier) => (
        <SupplierCard
          key={supplier.id}
          supplier={supplier}
          onClick={(s) => console.log('Clicked:', s.name)}
          onViewProducts={(s) => console.log('View products:', s.name)}
        />
      ))}
    </div>
  ),
  decorators: [
    (Story) => (
      <div style={{ width: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};

/** 紧凑列表 */
export const CompactList: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '300px' }}>
      {mockSuppliers.map((supplier) => (
        <SupplierCard
          key={supplier.id}
          supplier={supplier}
          variant="compact"
          onClick={(s) => console.log('Clicked:', s.name)}
        />
      ))}
    </div>
  ),
  decorators: [
    (Story) => (
      <div style={{ width: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};

/** 英文版本 */
export const EnglishVersion: Story = {
  args: {
    supplier: mockSuppliers[0],
    language: 'en',
  },
};
