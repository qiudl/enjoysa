import type { Meta, StoryObj } from '@storybook/react';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import { useState } from 'react';
import type { PaymentMethod } from '../../../types';

const meta: Meta<typeof PaymentMethodSelector> = {
  title: 'Components/Order/PaymentMethodSelector',
  component: PaymentMethodSelector,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '支付方式选择组件，支持微信、支付宝、信用卡、PayPal等多种支付方式。',
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
        <div style={{ width: '450px' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: '是否禁用',
    },
  },
};

export default meta;
type Story = StoryObj<typeof PaymentMethodSelector>;

/** 默认支付方式选择器 */
export const Default: Story = {
  args: {
    availableMethods: ['wechat', 'alipay', 'credit_card', 'paypal'],
    onSelect: (method) => console.log('Selected:', method),
  },
};

/** 已选中支付方式 */
export const WithSelection: Story = {
  args: {
    ...Default.args,
    selectedMethod: 'wechat',
  },
};

/** 交互式选择 */
export const Interactive: Story = {
  render: () => {
    const [selected, setSelected] = useState<PaymentMethod | undefined>();

    return (
      <PaymentMethodSelector
        selectedMethod={selected}
        availableMethods={['wechat', 'alipay', 'credit_card', 'paypal']}
        onSelect={setSelected}
      />
    );
  },
};

/** 仅国内支付方式 */
export const DomesticOnly: Story = {
  args: {
    availableMethods: ['wechat', 'alipay'],
    onSelect: (method) => console.log('Selected:', method),
  },
};

/** 仅国际支付方式 */
export const InternationalOnly: Story = {
  args: {
    availableMethods: ['credit_card', 'paypal'],
    onSelect: (method) => console.log('Selected:', method),
  },
};

/** 包含银行转账 */
export const WithBankTransfer: Story = {
  args: {
    availableMethods: ['wechat', 'alipay', 'credit_card', 'bank_transfer'],
    onSelect: (method) => console.log('Selected:', method),
  },
};

/** 禁用状态 */
export const Disabled: Story = {
  args: {
    ...Default.args,
    selectedMethod: 'wechat',
    disabled: true,
  },
};

/** 英文版本 */
export const EnglishVersion: Story = {
  args: {
    ...Default.args,
  },
  decorators: [
    (Story) => {
      i18n.changeLanguage('en');
      return (
        <div style={{ width: '450px' }}>
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
