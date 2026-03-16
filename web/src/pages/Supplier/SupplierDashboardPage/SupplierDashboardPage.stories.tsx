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
    supplierName: '祥龙旅行社',
    supplierType: 'travel_agency',
  },
};

/** 酒店供应商 */
export const Hotel: Story = {
  args: {
    supplierName: '阿德莱德希尔顿酒店',
    supplierType: 'hotel',
  },
};

/** 景区供应商 */
export const Attraction: Story = {
  args: {
    supplierName: '袋鼠岛野生动物园',
    supplierType: 'attraction',
  },
};

/** 英文版 */
export const English: Story = {
  args: {
    supplierName: 'Adelaide Tours Co.',
    supplierType: 'travel_agency',
  },
};

/** 新供应商 - 无数据 */
export const NewSupplier: Story = {
  args: {
    supplierName: '新注册旅行社',
  },
};
