import type { Meta, StoryObj } from '@storybook/react';
import { RegisterForm } from './RegisterForm';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof RegisterForm> = {
  title: 'Components/Auth/RegisterForm',
  component: RegisterForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '用户注册表单组件，支持手机号和邮箱注册。',
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
type Story = StoryObj<typeof RegisterForm>;

/** 默认注册表单 */
export const Default: Story = {
  args: {
    onSuccess: (data) => {
      console.log('Register success:', data);
      alert(`注册成功！昵称: ${data.nickname}`);
    },
    onSwitchToLogin: () => {
      console.log('Switch to login');
      alert('跳转到登录页面');
    },
    onViewTerms: () => {
      console.log('View terms');
      alert('查看服务条款');
    },
    onViewPrivacy: () => {
      console.log('View privacy');
      alert('查看隐私政策');
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
