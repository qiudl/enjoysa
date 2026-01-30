import type { Meta, StoryObj } from '@storybook/react';
import { LoginForm } from './LoginForm';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof LoginForm> = {
  title: 'Components/Auth/LoginForm',
  component: LoginForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '用户登录表单组件，支持手机号和邮箱登录，以及第三方登录（微信、Google）。',
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
type Story = StoryObj<typeof LoginForm>;

/** 默认登录表单 */
export const Default: Story = {
  args: {
    onSuccess: (data) => {
      console.log('Login success:', data);
      alert(`登录成功！${data.type === 'phone' ? '手机号' : '邮箱'}: ${data.identifier}`);
    },
    onSwitchToRegister: () => {
      console.log('Switch to register');
      alert('跳转到注册页面');
    },
    onForgotPassword: () => {
      console.log('Forgot password');
      alert('跳转到忘记密码页面');
    },
    onThirdPartyLogin: (provider) => {
      console.log('Third party login:', provider);
      alert(`使用 ${provider === 'wechat' ? '微信' : 'Google'} 登录`);
    },
  },
};

/** 手机号登录 */
export const PhoneLogin: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    docs: {
      description: {
        story: '默认显示手机号登录表单，适合国内用户。',
      },
    },
  },
};

/** 邮箱登录 */
export const EmailLogin: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    docs: {
      description: {
        story: '切换到邮箱登录，适合海外用户。',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story: '英文版本的登录表单。',
      },
    },
  },
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

/** 深色背景 */
export const DarkBackground: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
