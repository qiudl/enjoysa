import type { Meta, StoryObj } from '@storybook/react';
import { ProductListPage } from './ProductListPage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

const meta: Meta<typeof ProductListPage> = {
  title: 'Pages/ProductListPage',
  component: ProductListPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '产品列表页面，包含搜索、筛选、排序、分页功能。',
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
type Story = StoryObj<typeof ProductListPage>;

/** 默认列表页 */
export const Default: Story = {
  args: {
    language: 'zh',
    isLoggedIn: false,
  },
};

/** 带搜索词 */
export const WithKeyword: Story = {
  args: {
    language: 'zh',
    initialKeyword: '袋鼠岛',
  },
};

/** 已登录状态 */
export const LoggedIn: Story = {
  args: {
    language: 'zh',
    isLoggedIn: true,
    userName: '张三',
    cartCount: 2,
  },
};

/** 加载中 */
export const Loading: Story = {
  args: {
    language: 'zh',
    loading: true,
  },
};

/** 英文版 */
export const English: Story = {
  args: {
    language: 'en',
    isLoggedIn: false,
  },
};
