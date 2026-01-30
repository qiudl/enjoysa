import type { Meta, StoryObj } from '@storybook/react';
import { SupplierSettlementPage } from './SupplierSettlementPage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof SupplierSettlementPage> = {
  title: 'Pages/Supplier/SupplierSettlementPage',
  component: SupplierSettlementPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '供应商财务结算页面，支持查看资金概览、收款账户信息、结算记录。',
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
type Story = StoryObj<typeof SupplierSettlementPage>;

/** 默认 */
export const Default: Story = {
  args: {
    language: 'zh',
    supplierName: '祥龙旅行社',
    pendingAmount: 32112,
    settledAmount: 156800,
    monthSales: 35680,
  },
};

/** 英文版 */
export const English: Story = {
  args: {
    language: 'en',
    supplierName: 'Adelaide Tours Co.',
    pendingAmount: 32112,
    settledAmount: 156800,
    monthSales: 35680,
  },
};

/** 高额结算 */
export const HighAmount: Story = {
  args: {
    language: 'zh',
    supplierName: '南澳精品旅游',
    pendingAmount: 128500,
    settledAmount: 1568000,
    monthSales: 356800,
  },
};
