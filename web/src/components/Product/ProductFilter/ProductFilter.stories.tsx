import type { Meta, StoryObj } from '@storybook/react';
import { ProductFilter } from './ProductFilter';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import { useState } from 'react';
import type { ProductFilter as FilterType, ProductCategory, Destination } from '../../../types';

const mockCategories: ProductCategory[] = [
  { id: '1', name: '一日游', nameEn: 'Day Tours' },
  { id: '2', name: '多日游', nameEn: 'Multi-day Tours' },
  { id: '3', name: '门票', nameEn: 'Tickets & Passes' },
  { id: '4', name: '美食体验', nameEn: 'Food & Dining' },
  { id: '5', name: '户外探险', nameEn: 'Outdoor Adventures' },
];

const mockDestinations: Destination[] = [
  { id: '1', name: '袋鼠岛', nameEn: 'Kangaroo Island', region: '南澳', regionEn: 'SA' },
  { id: '2', name: '巴罗莎谷', nameEn: 'Barossa Valley', region: '南澳', regionEn: 'SA' },
  { id: '3', name: '阿德莱德市区', nameEn: 'Adelaide City', region: '南澳', regionEn: 'SA' },
  { id: '4', name: '弗林德斯山脉', nameEn: 'Flinders Ranges', region: '南澳', regionEn: 'SA' },
  { id: '5', name: '艾尔半岛', nameEn: 'Eyre Peninsula', region: '南澳', regionEn: 'SA' },
];

const meta: Meta<typeof ProductFilter> = {
  title: 'Components/Product/ProductFilter',
  component: ProductFilter,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: '产品筛选组件，支持分类、目的地、价格、评分等多维度筛选。',
      },
    },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <div style={{ maxWidth: '900px' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  argTypes: {
    layout: {
      control: 'radio',
      options: ['horizontal', 'vertical'],
      description: '布局方式',
    },
    showAdvanced: {
      control: 'boolean',
      description: '是否默认显示高级筛选',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProductFilter>;

/** 默认筛选 */
export const Default: Story = {
  args: {
    categories: mockCategories,
    destinations: mockDestinations,
    onChange: (filters) => console.log('Filters changed:', filters),
    onReset: () => console.log('Filters reset'),
  },
};

/** 带初始筛选条件 */
export const WithInitialFilters: Story = {
  args: {
    ...Default.args,
    filters: {
      category: '1',
      priceMin: 200,
      priceMax: 500,
      sortBy: 'price_asc',
    },
  },
};

/** 显示高级筛选 */
export const WithAdvancedFilters: Story = {
  args: {
    ...Default.args,
    showAdvanced: true,
    filters: {
      tags: ['hot', 'recommended'],
    },
  },
};

/** 交互式筛选 */
export const Interactive: Story = {
  render: () => {
    const [filters, setFilters] = useState<Partial<FilterType>>({});

    return (
      <div>
        <ProductFilter
          filters={filters}
          categories={mockCategories}
          destinations={mockDestinations}
          onChange={setFilters}
          onReset={() => setFilters({})}
          showAdvanced
        />
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#f5f5f5',
          borderRadius: '8px',
          fontSize: '14px',
        }}>
          <strong>当前筛选条件:</strong>
          <pre>{JSON.stringify(filters, null, 2)}</pre>
        </div>
      </div>
    );
  },
};

/** 英文版本 */
export const EnglishVersion: Story = {
  args: {
    ...Default.args,
  },
  decorators: [
    (Story) => {
      i18n.changeLanguage('en');
      return (
        <I18nextProvider i18n={i18n}>
          <div style={{ maxWidth: '900px' }}>
            <Story />
          </div>
        </I18nextProvider>
      );
    },
  ],
};

/** 移动端视图 */
export const MobileView: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <div style={{ width: '100%', padding: '0.5rem' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
};
