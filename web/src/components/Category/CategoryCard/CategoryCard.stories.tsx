import type { Meta, StoryObj } from '@storybook/react';
import { CategoryCard } from './CategoryCard';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import { useState } from 'react';
import type { ProductCategory } from '../../../types';

const mockCategories: ProductCategory[] = [
  { id: '1', name: '一日游', nameEn: 'Day Tours' },
  { id: '2', name: '多日游', nameEn: 'Multi-day Tours' },
  { id: '3', name: '门票', nameEn: 'Tickets & Passes' },
  { id: '4', name: '美食体验', nameEn: 'Food & Dining' },
  { id: '5', name: '户外探险', nameEn: 'Outdoor Adventures' },
  { id: '6', name: '水上活动', nameEn: 'Water Activities' },
  { id: '7', name: '酒庄之旅', nameEn: 'Wine Tours' },
  { id: '8', name: '摄影之旅', nameEn: 'Photography Tours' },
];

const meta: Meta<typeof CategoryCard> = {
  title: 'Components/Category/CategoryCard',
  component: CategoryCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '分类卡片组件，用于展示产品分类，支持多种变体和交互状态。',
      },
    },
    backgrounds: {
      default: 'gray',
      values: [
        { name: 'gray', value: '#f7fafc' },
        { name: 'dark', value: '#1a1a2e' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <Story />
      </I18nextProvider>
    ),
  ],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'compact', 'icon-only'],
      description: '卡片变体',
    },
    selected: {
      control: 'boolean',
      description: '是否选中',
    },
    productCount: {
      control: { type: 'number', min: 0, max: 200 },
      description: '产品数量',
    },
    language: {
      control: 'radio',
      options: ['zh', 'en'],
      description: '语言',
    },
  },
};

export default meta;
type Story = StoryObj<typeof CategoryCard>;

/** 默认分类卡片 */
export const Default: Story = {
  args: {
    category: mockCategories[0],
    productCount: 42,
    onClick: (cat) => console.log('Clicked:', cat.name),
  },
  decorators: [
    (Story) => (
      <div style={{ width: '200px' }}>
        <Story />
      </div>
    ),
  ],
};

/** 紧凑变体 */
export const Compact: Story = {
  args: {
    ...Default.args,
    variant: 'compact',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '160px' }}>
        <Story />
      </div>
    ),
  ],
};

/** 仅图标 */
export const IconOnly: Story = {
  args: {
    ...Default.args,
    variant: 'icon-only',
  },
};

/** 选中状态 */
export const Selected: Story = {
  args: {
    ...Default.args,
    selected: true,
  },
  decorators: Default.decorators,
};

/** 带背景图片 */
export const WithBackgroundImage: Story = {
  args: {
    ...Default.args,
    backgroundImage: 'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=400&h=300&fit=crop',
  },
  decorators: Default.decorators,
};

/** 英文版本 */
export const EnglishVersion: Story = {
  args: {
    ...Default.args,
    language: 'en',
  },
  decorators: [
    (Story) => {
      i18n.changeLanguage('en');
      return (
        <div style={{ width: '200px' }}>
          <I18nextProvider i18n={i18n}>
            <Story />
          </I18nextProvider>
        </div>
      );
    },
  ],
};

/** 分类网格 */
export const CategoryGrid: Story = {
  render: () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 180px)',
      gap: '1rem',
    }}>
      {mockCategories.map((cat) => (
        <CategoryCard
          key={cat.id}
          category={cat}
          productCount={Math.floor(Math.random() * 80) + 10}
          onClick={(c) => console.log('Clicked:', c.name)}
        />
      ))}
    </div>
  ),
};

/** 紧凑网格 */
export const CompactGrid: Story = {
  render: () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 140px)',
      gap: '0.75rem',
    }}>
      {mockCategories.map((cat) => (
        <CategoryCard
          key={cat.id}
          category={cat}
          variant="compact"
          productCount={Math.floor(Math.random() * 50) + 5}
          onClick={(c) => console.log('Clicked:', c.name)}
        />
      ))}
    </div>
  ),
};

/** 图标横条 */
export const IconBar: Story = {
  render: () => (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
    }}>
      {mockCategories.map((cat) => (
        <CategoryCard
          key={cat.id}
          category={cat}
          variant="icon-only"
          onClick={(c) => console.log('Clicked:', c.name)}
        />
      ))}
    </div>
  ),
};

/** 可选择分类 */
export const Selectable: Story = {
  render: () => {
    const [selected, setSelected] = useState<string | null>(null);

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 180px)',
        gap: '1rem',
      }}>
        {mockCategories.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            productCount={Math.floor(Math.random() * 80) + 10}
            selected={selected === cat.id}
            onClick={(c) => setSelected(c.id)}
          />
        ))}
      </div>
    );
  },
};

/** 移动端视图 */
export const MobileView: Story = {
  render: () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '0.75rem',
      width: '320px',
    }}>
      {mockCategories.slice(0, 6).map((cat) => (
        <CategoryCard
          key={cat.id}
          category={cat}
          variant="compact"
          productCount={Math.floor(Math.random() * 50) + 5}
          onClick={(c) => console.log('Clicked:', c.name)}
        />
      ))}
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
