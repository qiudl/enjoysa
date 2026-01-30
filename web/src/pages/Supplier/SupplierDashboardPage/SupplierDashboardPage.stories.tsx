import type { Meta, StoryObj } from '@storybook/react';
import { SupplierDashboardPage } from './SupplierDashboardPage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof SupplierDashboardPage> = {
  title: 'Pages/Supplier/SupplierDashboardPage',
  component: SupplierDashboardPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '供应商后台仪表盘页面，展示数据概览、快捷操作、最近订单。',
      },
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
    language: {
      control: 'radio',
      options: ['zh', 'en'],
    },
    supplierType: {
      control: 'select',
      options: ['travel_agency', 'hotel', 'attraction', 'restaurant', 'car_rental'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof SupplierDashboardPage>;

/** 默认 - 旅行社 */
export const Default: Story = {
  args: {
    language: 'zh',
    supplierName: '祥龙旅行社',
    supplierType: 'travel_agency',
    pendingOrders: 5,
    todayOrders: 12,
    monthSales: 28650,
    pendingSettlement: 15800,
    productCount: 24,
    activeProducts: 18,
  },
};

/** 酒店供应商 */
export const Hotel: Story = {
  args: {
    ...Default.args,
    supplierName: '阿德莱德希尔顿酒店',
    supplierType: 'hotel',
    pendingOrders: 8,
    todayOrders: 25,
    monthSales: 156000,
    pendingSettlement: 45000,
    productCount: 12,
    activeProducts: 10,
  },
};

/** 景区供应商 */
export const Attraction: Story = {
  args: {
    ...Default.args,
    supplierName: '袋鼠岛野生动物园',
    supplierType: 'attraction',
    pendingOrders: 3,
    todayOrders: 45,
    monthSales: 89000,
    pendingSettlement: 32000,
    productCount: 8,
    activeProducts: 8,
  },
};

/** 英文版 */
export const English: Story = {
  args: {
    language: 'en',
    supplierName: 'Adelaide Tours Co.',
    supplierType: 'travel_agency',
    pendingOrders: 5,
    todayOrders: 12,
    monthSales: 28650,
    pendingSettlement: 15800,
    productCount: 24,
    activeProducts: 18,
  },
};

/** 新供应商 - 无数据 */
export const NewSupplier: Story = {
  args: {
    ...Default.args,
    supplierName: '新注册旅行社',
    pendingOrders: 0,
    todayOrders: 0,
    monthSales: 0,
    pendingSettlement: 0,
    productCount: 2,
    activeProducts: 0,
  },
};
