import type { Meta, StoryObj } from '@storybook/react';
import { OrderSummary } from './OrderSummary';
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

const meta: Meta<typeof OrderSummary> = {
  title: 'Components/Order/OrderSummary',
  component: OrderSummary,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '订单摘要组件，展示订单的产品信息、预订详情和价格明细。',
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
        <div style={{ width: '380px' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  argTypes: {
    showDetails: {
      control: 'boolean',
      description: '是否显示详情',
    },
    adultCount: {
      control: { type: 'number', min: 1, max: 10 },
      description: '成人数量',
    },
    childCount: {
      control: { type: 'number', min: 0, max: 10 },
      description: '儿童数量',
    },
    discountAmount: {
      control: { type: 'number', min: 0, max: 500 },
      description: '优惠金额',
    },
    language: {
      control: 'radio',
      options: ['zh', 'en'],
      description: '语言',
    },
  },
};

export default meta;
type Story = StoryObj<typeof OrderSummary>;

/** 默认订单摘要 */
export const Default: Story = {
  args: {
    product: mockProduct,
    travelDate: '2026-02-15',
    adultCount: 2,
    childCount: 0,
  },
};

/** 带儿童 */
export const WithChildren: Story = {
  args: {
    ...Default.args,
    adultCount: 2,
    childCount: 1,
  },
};

/** 带优惠券 */
export const WithDiscount: Story = {
  args: {
    ...Default.args,
    adultCount: 2,
    couponCode: 'SUMMER20',
    discountAmount: 50,
  },
};

/** 简洁模式（不显示详情） */
export const Compact: Story = {
  args: {
    ...Default.args,
    showDetails: false,
  },
};

/** 大订单 */
export const LargeOrder: Story = {
  args: {
    ...Default.args,
    adultCount: 6,
    childCount: 2,
    couponCode: 'GROUP100',
    discountAmount: 100,
  },
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
        <div style={{ width: '380px' }}>
          <I18nextProvider i18n={i18n}>
            <Story />
          </I18nextProvider>
        </div>
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
      <div style={{ width: '100%', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
};
