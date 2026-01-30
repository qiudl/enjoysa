import type { Meta, StoryObj } from '@storybook/react';
import { LoginPage } from './LoginPage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

const meta: Meta<typeof LoginPage> = {
  title: 'Pages/LoginPage',
  component: LoginPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '登录/注册页面，包含品牌展示和表单切换。',
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
    initialMode: {
      control: 'radio',
      options: ['login', 'register'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof LoginPage>;

/** 登录模式 */
export const Login: Story = {
  args: {
    language: 'zh',
    initialMode: 'login',
  },
};

/** 注册模式 */
export const Register: Story = {
  args: {
    language: 'zh',
    initialMode: 'register',
  },
};

/** 英文登录 */
export const EnglishLogin: Story = {
  args: {
    language: 'en',
    initialMode: 'login',
  },
};

/** 英文注册 */
export const EnglishRegister: Story = {
  args: {
    language: 'en',
    initialMode: 'register',
  },
};
