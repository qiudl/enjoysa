import type { Meta, StoryObj } from '@storybook/react';
import { UserProfile } from './UserProfile';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const mockUser = {
  id: '1',
  nickname: '旅行达人',
  email: 'traveler@example.com',
  phone: '+86 138 0000 0000',
  language: 'zh' as const,
  createdAt: '2026-01-01',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&h=128&fit=crop',
};

const mockUserNoAvatar = {
  id: '2',
  nickname: '南澳游客',
  email: 'visitor@example.com',
  language: 'zh' as const,
  createdAt: '2026-01-15',
};

const meta: Meta<typeof UserProfile> = {
  title: 'Components/User/UserProfile',
  component: UserProfile,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '用户个人中心组件，展示用户信息、统计数据和功能入口。',
      },
    },
    backgrounds: {
      default: 'gray',
      values: [
        { name: 'gray', value: '#f7fafc' },
        { name: 'dark', value: '#1a202c' },
      ],
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
type Story = StoryObj<typeof UserProfile>;

/** 默认个人中心 */
export const Default: Story = {
  args: {
    user: mockUser,
    orderCount: 12,
    favoriteCount: 28,
    reviewCount: 5,
    onOrdersClick: () => alert('查看订单'),
    onFavoritesClick: () => alert('查看收藏'),
    onReviewsClick: () => alert('查看评价'),
    onSettingsClick: () => alert('打开设置'),
    onEditProfile: () => alert('编辑资料'),
    onLogout: () => alert('退出登录'),
  },
};

/** 无头像用户 */
export const NoAvatar: Story = {
  args: {
    user: mockUserNoAvatar,
    orderCount: 3,
    favoriteCount: 15,
    reviewCount: 1,
    onOrdersClick: () => alert('查看订单'),
    onFavoritesClick: () => alert('查看收藏'),
    onReviewsClick: () => alert('查看评价'),
    onSettingsClick: () => alert('打开设置'),
    onEditProfile: () => alert('编辑资料'),
    onLogout: () => alert('退出登录'),
  },
};

/** 新用户（无数据） */
export const NewUser: Story = {
  args: {
    user: mockUserNoAvatar,
    orderCount: 0,
    favoriteCount: 0,
    reviewCount: 0,
    onOrdersClick: () => alert('查看订单'),
    onFavoritesClick: () => alert('查看收藏'),
    onReviewsClick: () => alert('查看评价'),
    onSettingsClick: () => alert('打开设置'),
    onEditProfile: () => alert('编辑资料'),
    onLogout: () => alert('退出登录'),
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
        <I18nextProvider i18n={i18n}>
          <Story />
        </I18nextProvider>
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
};
