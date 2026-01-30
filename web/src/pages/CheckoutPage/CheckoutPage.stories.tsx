import type { Meta, StoryObj } from '@storybook/react';
import { CheckoutPage } from './CheckoutPage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

const meta: Meta<typeof CheckoutPage> = {
  title: 'Pages/CheckoutPage',
  component: CheckoutPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '结算页面，包含出行人信息、支付方式选择、订单摘要。',
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
    isLoggedIn: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof CheckoutPage>;

/** 默认结算页 */
export const Default: Story = {
  args: {
    language: 'zh',
    isLoggedIn: true,
    userName: '张三',
  },
};

/** 未登录状态 */
export const NotLoggedIn: Story = {
  args: {
    language: 'zh',
    isLoggedIn: false,
  },
};

/** 英文版 */
export const English: Story = {
  args: {
    language: 'en',
    isLoggedIn: true,
    userName: 'John Doe',
  },
};

/** 多人订单 */
export const MultipleParticipants: Story = {
  args: {
    language: 'zh',
    isLoggedIn: true,
    userName: '张三',
    adultCount: 4,
    travelDate: '2026-02-15',
  },
};
