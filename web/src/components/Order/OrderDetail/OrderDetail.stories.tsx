import type { Meta, StoryObj } from '@storybook/react';
import { OrderDetail } from './OrderDetail';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import type { Order } from '../../../types';

const pendingOrder: Order = {
  id: '1',
  orderNumber: 'ES20260130001',
  userId: 'u1',
  items: [
    {
      id: 'i1',
      productId: 'p1',
      productTitle: '袋鼠岛野生动物探索一日游',
      productTitleEn: 'Kangaroo Island Wildlife Day Tour',
      productImage: 'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=800&h=600&fit=crop',
      travelDate: '2026-02-15',
      quantity: 2,
      unitPrice: 389,
      subtotal: 778,
      totalPrice: 778,
      participants: [{ type: 'adult', count: 2 }],
    },
  ],
  status: 'pending_payment',
  paymentStatus: 'unpaid',
  totalAmount: 778,
  currency: 'AUD',
  paymentMethod: 'wechat',
  contactInfo: {
    name: '张三',
    phone: '+86 138 0000 0000',
    email: 'zhangsan@example.com',
  },
  createdAt: '2026-01-30T10:30:00Z',
  updatedAt: '2026-01-30T10:30:00Z',
};

const confirmedOrder: Order = {
  id: '2',
  orderNumber: 'ES20260128002',
  userId: 'u1',
  items: [
    {
      id: 'i2',
      productId: 'p2',
      productTitle: '巴罗萨谷酒庄品酒之旅',
      productTitleEn: 'Barossa Valley Wine Tasting Tour',
      productImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
      travelDate: '2026-02-20',
      quantity: 3,
      unitPrice: 299,
      subtotal: 897,
      totalPrice: 897,
      participants: [{ type: 'adult', count: 3 }],
    },
  ],
  status: 'confirmed',
  paymentStatus: 'paid',
  totalAmount: 897,
  currency: 'AUD',
  paymentMethod: 'alipay',
  contactInfo: {
    name: '张三',
    phone: '+86 138 0000 0000',
    email: 'zhangsan@example.com',
  },
  createdAt: '2026-01-28T15:20:00Z',
  updatedAt: '2026-01-28T16:00:00Z',
  paidAt: '2026-01-28T15:25:00Z',
};

const completedOrder: Order = {
  id: '3',
  orderNumber: 'ES20260120003',
  userId: 'u1',
  items: [
    {
      id: 'i3',
      productId: 'p3',
      productTitle: '阿德莱德市区美食漫步',
      productTitleEn: 'Adelaide City Food Walk',
      productImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop',
      travelDate: '2026-01-25',
      quantity: 2,
      unitPrice: 159,
      subtotal: 318,
      totalPrice: 318,
      participants: [{ type: 'adult', count: 2 }],
    },
  ],
  status: 'completed',
  paymentStatus: 'paid',
  totalAmount: 318,
  currency: 'AUD',
  paymentMethod: 'credit_card',
  contactInfo: {
    name: '张三',
    phone: '+86 138 0000 0000',
    email: 'zhangsan@example.com',
  },
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T18:00:00Z',
  paidAt: '2026-01-20T09:05:00Z',
  completedAt: '2026-01-25T18:00:00Z',
};

const cancelledOrder: Order = {
  id: '4',
  orderNumber: 'ES20260115004',
  userId: 'u1',
  items: [
    {
      id: 'i4',
      productId: 'p4',
      productTitle: '海豚巡航体验',
      productTitleEn: 'Dolphin Cruise Experience',
      productImage: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
      travelDate: '2026-01-18',
      quantity: 2,
      unitPrice: 199,
      subtotal: 398,
      totalPrice: 398,
      participants: [{ type: 'adult', count: 2 }],
    },
  ],
  status: 'cancelled',
  paymentStatus: 'refunded',
  totalAmount: 398,
  currency: 'AUD',
  contactInfo: {
    name: '张三',
    phone: '+86 138 0000 0000',
    email: 'zhangsan@example.com',
  },
  createdAt: '2026-01-15T14:00:00Z',
  updatedAt: '2026-01-16T10:00:00Z',
  cancelledAt: '2026-01-16T10:00:00Z',
};

const multiItemOrder: Order = {
  id: '5',
  orderNumber: 'ES20260125005',
  userId: 'u1',
  items: [
    {
      id: 'i5',
      productId: 'p1',
      productTitle: '袋鼠岛野生动物探索一日游',
      productTitleEn: 'Kangaroo Island Wildlife Day Tour',
      productImage: 'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=800&h=600&fit=crop',
      travelDate: '2026-02-15',
      quantity: 2,
      unitPrice: 389,
      subtotal: 778,
      totalPrice: 778,
      participants: [{ type: 'adult', count: 2 }],
    },
    {
      id: 'i6',
      productId: 'p2',
      productTitle: '巴罗萨谷酒庄品酒之旅',
      productTitleEn: 'Barossa Valley Wine Tasting Tour',
      productImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
      travelDate: '2026-02-16',
      quantity: 2,
      unitPrice: 299,
      subtotal: 598,
      totalPrice: 598,
      participants: [{ type: 'adult', count: 2 }],
    },
  ],
  status: 'confirmed',
  paymentStatus: 'paid',
  totalAmount: 1376,
  currency: 'AUD',
  paymentMethod: 'wechat',
  contactInfo: {
    name: '张三',
    phone: '+86 138 0000 0000',
    email: 'zhangsan@example.com',
  },
  createdAt: '2026-01-25T10:00:00Z',
  updatedAt: '2026-01-25T10:30:00Z',
  paidAt: '2026-01-25T10:05:00Z',
};

const meta: Meta<typeof OrderDetail> = {
  title: 'Components/Order/OrderDetail',
  component: OrderDetail,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '订单详情组件，展示订单完整信息，包括状态、商品、联系方式、支付信息等。',
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
        <div style={{ width: '500px' }}>
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
type Story = StoryObj<typeof OrderDetail>;

/** 待支付订单 */
export const PendingPayment: Story = {
  args: {
    order: pendingOrder,
    onPay: () => console.log('Pay clicked'),
    onCancel: () => console.log('Cancel clicked'),
    onContactSupport: () => console.log('Contact support clicked'),
  },
};

/** 已确认订单 */
export const Confirmed: Story = {
  args: {
    order: confirmedOrder,
    onViewVoucher: () => console.log('View voucher clicked'),
    onRefund: () => console.log('Refund clicked'),
    onContactSupport: () => console.log('Contact support clicked'),
  },
};

/** 已完成订单 */
export const Completed: Story = {
  args: {
    order: completedOrder,
    onWriteReview: () => console.log('Write review clicked'),
    onReorder: () => console.log('Reorder clicked'),
    onContactSupport: () => console.log('Contact support clicked'),
  },
};

/** 已取消订单 */
export const Cancelled: Story = {
  args: {
    order: cancelledOrder,
    onReorder: () => console.log('Reorder clicked'),
    onContactSupport: () => console.log('Contact support clicked'),
  },
};

/** 多商品订单 */
export const MultipleItems: Story = {
  args: {
    order: multiItemOrder,
    onViewVoucher: () => console.log('View voucher clicked'),
    onRefund: () => console.log('Refund clicked'),
    onContactSupport: () => console.log('Contact support clicked'),
  },
};

/** 英文版本 */
export const EnglishVersion: Story = {
  args: {
    order: confirmedOrder,
    language: 'en',
  },
  decorators: [
    (Story) => {
      i18n.changeLanguage('en');
      return (
        <div style={{ width: '500px' }}>
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
    order: confirmedOrder,
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
