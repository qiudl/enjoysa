import type { Meta, StoryObj } from '@storybook/react';
import { ProductDetailPage } from './ProductDetailPage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

const meta: Meta<typeof ProductDetailPage> = {
  title: 'Pages/ProductDetailPage',
  component: ProductDetailPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '产品详情页，展示产品信息、图片、价格和预订功能。',
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
    loading: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProductDetailPage>;

/** 默认产品详情页 */
export const Default: Story = {
  args: {
    language: 'zh',
    isLoggedIn: false,
    cartCount: 0,
  },
};

/** 已登录用户 */
export const LoggedIn: Story = {
  args: {
    language: 'zh',
    isLoggedIn: true,
    userName: '张三',
    cartCount: 2,
  },
};

/** 英文版 */
export const English: Story = {
  args: {
    language: 'en',
    isLoggedIn: true,
    userName: 'John Doe',
    cartCount: 1,
  },
};

/** 加载中 */
export const Loading: Story = {
  args: {
    language: 'zh',
    loading: true,
  },
};
