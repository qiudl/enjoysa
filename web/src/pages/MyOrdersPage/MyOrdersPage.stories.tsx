import type { Meta, StoryObj } from '@storybook/react';
import { MyOrdersPage } from './MyOrdersPage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

const meta: Meta<typeof MyOrdersPage> = {
  title: 'Pages/MyOrdersPage',
  component: MyOrdersPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '我的订单页面，包含订单列表、状态筛选、订单详情。',
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
    loading: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MyOrdersPage>;

/** 默认订单列表 */
export const Default: Story = {
  args: {
    language: 'zh',
    userName: '张三',
  },
};

/** 加载中 */
export const Loading: Story = {
  args: {
    language: 'zh',
    userName: '张三',
    loading: true,
  },
};

/** 英文版 */
export const English: Story = {
  args: {
    language: 'en',
    userName: 'John Doe',
  },
};

/** 带头像 */
export const WithAvatar: Story = {
  args: {
    language: 'zh',
    userName: '张三',
    userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
  },
};
