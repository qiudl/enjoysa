import type { Meta, StoryObj } from '@storybook/react';
import { SupplierOrderListPage } from './SupplierOrderListPage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof SupplierOrderListPage> = {
  title: 'Pages/Supplier/SupplierOrderListPage',
  component: SupplierOrderListPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '供应商订单管理页面，支持订单列表、筛选、确认、退款处理。',
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
  },
};

export default meta;
type Story = StoryObj<typeof SupplierOrderListPage>;

/** 默认 */
export const Default: Story = {
  args: {
    language: 'zh',
    supplierName: '祥龙旅行社',
  },
};

/** 英文版 */
export const English: Story = {
  args: {
    language: 'en',
    supplierName: 'Adelaide Tours Co.',
  },
};
