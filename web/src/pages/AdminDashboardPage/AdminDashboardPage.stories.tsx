import type { Meta, StoryObj } from '@storybook/react';
import { AdminDashboardPage } from './AdminDashboardPage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

const meta: Meta<typeof AdminDashboardPage> = {
  title: 'Pages/AdminDashboardPage',
  component: AdminDashboardPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '管理后台控制台页面，包含数据统计、订单列表、热门产品。',
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
type Story = StoryObj<typeof AdminDashboardPage>;

/** 默认后台 */
export const Default: Story = {
  args: {
    language: 'zh',
    adminName: '管理员',
  },
};

/** 带头像 */
export const WithAvatar: Story = {
  args: {
    language: 'zh',
    adminName: '张管理',
    adminAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
  },
};

/** 加载中 */
export const Loading: Story = {
  args: {
    language: 'zh',
    adminName: '管理员',
    loading: true,
  },
};

/** 英文版 */
export const English: Story = {
  args: {
    language: 'en',
    adminName: 'Admin',
  },
};
