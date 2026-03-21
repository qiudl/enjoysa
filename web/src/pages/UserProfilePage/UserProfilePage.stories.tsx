import type { Meta, StoryObj } from '@storybook/react';
import { UserProfilePage } from './UserProfilePage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

const meta: Meta<typeof UserProfilePage> = {
  title: 'Pages/UserProfilePage',
  component: UserProfilePage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '个人中心页面，展示用户信息、订单统计、快捷功能入口。',
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
};

export default meta;
type Story = StoryObj<typeof UserProfilePage>;

/** 默认个人中心 */
export const Default: Story = {
  args: {
    userName: '张三',
    userEmail: 'zhangsan@example.com',
    userPhone: '138****8000',
  },
};

/** 英文版 */
export const English: Story = {
  args: {
    userName: 'John Doe',
    userEmail: 'john@example.com',
    userPhone: '+61 412 345 678',
  },
};

/** 带头像 */
export const WithAvatar: Story = {
  args: {
    ...Default.args,
    userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
  },
};
