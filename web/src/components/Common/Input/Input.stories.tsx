import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';
import { Mail, Phone, Search, Lock, User } from 'lucide-react';
import { useState } from 'react';

const meta: Meta<typeof Input> = {
  title: 'Components/Common/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '通用输入框组件，支持多种状态和功能。',
      },
    },
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
      description: '输入框尺寸',
    },
    disabled: {
      control: 'boolean',
      description: '是否禁用',
    },
    clearable: {
      control: 'boolean',
      description: '是否显示清除按钮',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '320px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Input>;

/** 默认输入框 */
export const Default: Story = {
  args: {
    placeholder: '请输入内容',
  },
};

/** 带标签 */
export const WithLabel: Story = {
  args: {
    label: '邮箱地址',
    placeholder: '请输入邮箱',
    type: 'email',
  },
};

/** 必填项 */
export const Required: Story = {
  args: {
    label: '手机号码',
    placeholder: '请输入手机号',
    required: true,
  },
};

/** 错误状态 */
export const WithError: Story = {
  args: {
    label: '邮箱地址',
    placeholder: '请输入邮箱',
    error: '邮箱格式不正确',
    defaultValue: 'invalid-email',
  },
};

/** 帮助文本 */
export const WithHelperText: Story = {
  args: {
    label: '密码',
    type: 'password',
    placeholder: '请输入密码',
    helperText: '密码至少6位，包含字母和数字',
  },
};

/** 左侧图标 */
export const WithLeftIcon: Story = {
  args: {
    placeholder: '请输入邮箱',
    leftIcon: <Mail size={18} />,
  },
};

/** 不同尺寸 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Input size="sm" placeholder="小号输入框" />
      <Input size="md" placeholder="中号输入框" />
      <Input size="lg" placeholder="大号输入框" />
    </div>
  ),
};

/** 密码输入框 */
export const Password: Story = {
  args: {
    label: '密码',
    type: 'password',
    placeholder: '请输入密码',
    leftIcon: <Lock size={18} />,
  },
};

/** 可清除输入框 */
export const Clearable: Story = {
  render: () => {
    const [value, setValue] = useState('可清除的内容');
    return (
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClear={() => setValue('')}
        clearable
        placeholder="输入后可清除"
      />
    );
  },
};

/** 禁用状态 */
export const Disabled: Story = {
  args: {
    label: '禁用输入框',
    placeholder: '不可编辑',
    disabled: true,
    defaultValue: '禁用的内容',
  },
};

/** 搜索输入框 */
export const SearchInput: Story = {
  args: {
    placeholder: '搜索目的地、景点、活动...',
    leftIcon: <Search size={18} />,
  },
};

/** 表单示例 */
export const FormExample: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Input
        label="用户名"
        placeholder="请输入用户名"
        leftIcon={<User size={18} />}
        required
      />
      <Input
        label="邮箱"
        type="email"
        placeholder="请输入邮箱"
        leftIcon={<Mail size={18} />}
        required
      />
      <Input
        label="手机号"
        type="tel"
        placeholder="请输入手机号"
        leftIcon={<Phone size={18} />}
      />
      <Input
        label="密码"
        type="password"
        placeholder="请输入密码"
        leftIcon={<Lock size={18} />}
        helperText="密码至少6位"
        required
      />
    </div>
  ),
};
