import type { Meta, StoryObj } from '@storybook/react';
import { SupplierProductListPage } from './SupplierProductListPage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof SupplierProductListPage> = {
  title: 'Pages/Supplier/SupplierProductListPage',
  component: SupplierProductListPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '供应商产品管理页面，支持产品列表、搜索、筛选、上下架操作。',
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
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof SupplierProductListPage>;

/** 默认 */
export const Default: Story = {
  args: {},
};

/** 英文版 */
export const English: Story = {
  args: {},
};
