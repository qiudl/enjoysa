import type { Meta, StoryObj } from '@storybook/react';
import { HomePage } from './HomePage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

const meta: Meta<typeof HomePage> = {
  title: 'Pages/HomePage',
  component: HomePage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '畅游南澳首页，包含搜索、热门产品、目的地、分类等模块。',
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
    isLoggedIn: {
      control: 'boolean',
      description: '是否已登录',
    },
    loading: {
      control: 'boolean',
      description: '加载状态',
    },
    cartCount: {
      control: 'number',
      description: '购物车数量',
    },
  },
};

export default meta;
type Story = StoryObj<typeof HomePage>;

/** 默认首页（未登录） */
export const Default: Story = {
  args: {
    isLoggedIn: false,
    loading: false,
  },
};

/** 已登录状态 */
export const LoggedIn: Story = {
  args: {
    isLoggedIn: true,
    userName: '张三',
    userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
    cartCount: 3,
  },
};

/** 加载中 */
export const Loading: Story = {
  args: {
    loading: true,
  },
};

/** 已登录带购物车 */
export const LoggedInWithCart: Story = {
  args: {
    isLoggedIn: true,
    userName: 'John Doe',
    userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
    cartCount: 5,
  },
};
