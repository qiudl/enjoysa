import type { Meta, StoryObj } from '@storybook/react';
import { OrderList } from './OrderList';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import type { Order } from '../../../types';

const mockOrders: Order[] = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
];

const meta: Meta<typeof OrderList> = {
  title: 'Components/Order/OrderList',
  component: OrderList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: '订单列表组件，支持标签筛选、空状态展示。',
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
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  argTypes: {
    activeTab: {
      control: 'select',
      options: ['all', 'pending', 'confirmed', 'completed'],
      description: '当前选中的标签',
    },
    loading: {
      control: 'boolean',
      description: '是否加载中',
    },
    language: {
      control: 'radio',
      options: ['zh', 'en'],
      description: '语言',
    },
  },
};

export default meta;
type Story = StoryObj<typeof OrderList>;

/** 默认状态 */
export const Default: Story = {
  args: {
    orders: mockOrders,
    onOrderClick: (order) => console.log('Order clicked:', order.orderNumber),
    onActionClick: (order, action) => console.log('Action:', action, order.orderNumber),
    onTabChange: (tab) => console.log('Tab changed:', tab),
  },
};

/** 待支付标签 */
export const PendingTab: Story = {
  args: {
    ...Default.args,
    activeTab: 'pending',
  },
};

/** 已确认标签 */
export const ConfirmedTab: Story = {
  args: {
    ...Default.args,
    activeTab: 'confirmed',
  },
};

/** 已完成标签 */
export const CompletedTab: Story = {
  args: {
    ...Default.args,
    activeTab: 'completed',
  },
};

/** 加载中 */
export const Loading: Story = {
  args: {
    orders: [],
    loading: true,
  },
};

/** 空状态 */
export const Empty: Story = {
  args: {
    orders: [],
    showEmptyState: true,
    emptyText: '暂无订单记录',
    emptyAction: {
      text: '去逛逛',
      onClick: () => console.log('Go shopping'),
    },
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
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
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
};
