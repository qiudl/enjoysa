import type { Meta, StoryObj } from '@storybook/react';
import { ProductCard } from './ProductCard';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import type { Product } from '../../../types';

const mockProduct: Product = {
  id: '1',
  title: '袋鼠岛野生动物探索一日游',
  titleEn: 'Kangaroo Island Wildlife Discovery Day Tour',
  description: '探索南澳最著名的野生动物天堂',
  descriptionEn: 'Explore South Australia\'s most famous wildlife paradise',
  images: [
    'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1598805279631-e8e39c4b0d41?w=800&h=600&fit=crop',
  ],
  price: 389,
  originalPrice: 459,
  currency: 'AUD',
  rating: 4.8,
  reviewCount: 126,
  location: '阿德莱德',
  locationEn: 'Adelaide',
  duration: '12小时',
  durationEn: '12 hours',
  highlights: ['海豹湾观海豹', '弗林德斯蔡斯国家公园', '神奇岩石'],
  inclusions: ['酒店接送', '午餐', '导游'],
  exclusions: ['个人消费', '小费'],
  category: { id: '1', name: '一日游', nameEn: 'Day Tours' },
  destination: { id: '1', name: '袋鼠岛', nameEn: 'Kangaroo Island', region: '南澳', regionEn: 'SA' },
  tags: ['hot', 'recommended'],
  availability: 'available',
  instantConfirmation: true,
  freeCancellation: true,
  supplierId: 's1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-15',
};

const mockProductLimited: Product = {
  ...mockProduct,
  id: '2',
  title: '巴罗莎谷酒庄品酒之旅',
  titleEn: 'Barossa Valley Wine Tasting Tour',
  images: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop'],
  price: 299,
  originalPrice: undefined,
  rating: 4.9,
  reviewCount: 89,
  location: '巴罗莎谷',
  locationEn: 'Barossa Valley',
  duration: '8小时',
  tags: ['new', 'food'],
  availability: 'limited',
  instantConfirmation: true,
  freeCancellation: false,
};

const mockProductSoldOut: Product = {
  ...mockProduct,
  id: '3',
  title: '大堡礁浮潜体验',
  titleEn: 'Great Barrier Reef Snorkeling',
  images: ['https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop'],
  price: 599,
  rating: 4.7,
  reviewCount: 234,
  location: '凯恩斯',
  tags: ['adventure', 'nature'],
  availability: 'sold_out',
};

const meta: Meta<typeof ProductCard> = {
  title: 'Components/Product/ProductCard',
  component: ProductCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '产品卡片组件，用于展示旅游产品信息。支持多种变体和交互状态。',
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
        <Story />
      </I18nextProvider>
    ),
  ],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'compact', 'horizontal'],
      description: '卡片变体',
    },
    isFavorite: {
      control: 'boolean',
      description: '是否已收藏',
    },
    language: {
      control: 'radio',
      options: ['zh', 'en'],
      description: '语言',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProductCard>;

/** 默认产品卡片 */
export const Default: Story = {
  args: {
    product: mockProduct,
    isFavorite: false,
    onClick: (product) => console.log('Clicked:', product.title),
    onFavoriteToggle: (product) => console.log('Toggle favorite:', product.title),
    onAddToCart: (product) => console.log('Add to cart:', product.title),
  },
  decorators: [
    (Story) => (
      <div style={{ width: '300px' }}>
        <Story />
      </div>
    ),
  ],
};

/** 已收藏 */
export const Favorited: Story = {
  args: {
    ...Default.args,
    isFavorite: true,
  },
  decorators: Default.decorators,
};

/** 库存紧张 */
export const LimitedAvailability: Story = {
  args: {
    ...Default.args,
    product: mockProductLimited,
  },
  decorators: Default.decorators,
};

/** 已售罄 */
export const SoldOut: Story = {
  args: {
    ...Default.args,
    product: mockProductSoldOut,
  },
  decorators: Default.decorators,
};

/** 紧凑变体 */
export const Compact: Story = {
  args: {
    ...Default.args,
    variant: 'compact',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '200px' }}>
        <Story />
      </div>
    ),
  ],
};

/** 横向变体 */
export const Horizontal: Story = {
  args: {
    ...Default.args,
    variant: 'horizontal',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '500px' }}>
        <Story />
      </div>
    ),
  ],
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
        <div style={{ width: '300px' }}>
          <I18nextProvider i18n={i18n}>
            <Story />
          </I18nextProvider>
        </div>
      );
    },
  ],
};

/** 产品网格 */
export const ProductGrid: Story = {
  render: () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 300px)',
      gap: '1.5rem',
    }}>
      <ProductCard
        product={mockProduct}
        onClick={(p) => console.log('Clicked:', p.title)}
        onFavoriteToggle={(p) => console.log('Toggle:', p.title)}
      />
      <ProductCard
        product={mockProductLimited}
        isFavorite
        onClick={(p) => console.log('Clicked:', p.title)}
        onFavoriteToggle={(p) => console.log('Toggle:', p.title)}
      />
      <ProductCard
        product={mockProductSoldOut}
        onClick={(p) => console.log('Clicked:', p.title)}
        onFavoriteToggle={(p) => console.log('Toggle:', p.title)}
      />
    </div>
  ),
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
      <div style={{ width: '100%', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
};
