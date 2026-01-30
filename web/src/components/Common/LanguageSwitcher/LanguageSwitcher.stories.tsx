import type { Meta, StoryObj } from '@storybook/react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof LanguageSwitcher> = {
  title: 'Components/Common/LanguageSwitcher',
  component: LanguageSwitcher,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '语言切换组件，支持下拉菜单、按钮组和极简三种模式。',
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
    variant: {
      control: 'select',
      options: ['dropdown', 'buttons', 'minimal'],
      description: '变体样式',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
      description: '尺寸',
    },
    showIcon: {
      control: 'boolean',
      description: '是否显示图标',
    },
    showLabel: {
      control: 'boolean',
      description: '是否显示语言名称',
    },
  },
};

export default meta;
type Story = StoryObj<typeof LanguageSwitcher>;

/** 下拉菜单样式（默认） */
export const Dropdown: Story = {
  args: {
    variant: 'dropdown',
    size: 'md',
    showIcon: true,
    showLabel: true,
  },
};

/** 按钮组样式 */
export const Buttons: Story = {
  args: {
    variant: 'buttons',
    size: 'md',
  },
};

/** 极简样式 */
export const Minimal: Story = {
  args: {
    variant: 'minimal',
    size: 'md',
    showIcon: true,
    showLabel: true,
  },
};

/** 仅图标 */
export const IconOnly: Story = {
  args: {
    variant: 'dropdown',
    size: 'md',
    showIcon: true,
    showLabel: false,
  },
};

/** 不同尺寸 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ width: '60px', fontSize: '0.875rem', color: '#64748b' }}>Small:</span>
        <LanguageSwitcher variant="dropdown" size="sm" />
        <LanguageSwitcher variant="buttons" size="sm" />
        <LanguageSwitcher variant="minimal" size="sm" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ width: '60px', fontSize: '0.875rem', color: '#64748b' }}>Medium:</span>
        <LanguageSwitcher variant="dropdown" size="md" />
        <LanguageSwitcher variant="buttons" size="md" />
        <LanguageSwitcher variant="minimal" size="md" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ width: '60px', fontSize: '0.875rem', color: '#64748b' }}>Large:</span>
        <LanguageSwitcher variant="dropdown" size="lg" />
        <LanguageSwitcher variant="buttons" size="lg" />
        <LanguageSwitcher variant="minimal" size="lg" />
      </div>
    </div>
  ),
};

/** 在导航栏中使用 */
export const InNavbar: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 2rem',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        width: '600px',
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#0066ff' }}>
        EnjoySA
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <LanguageSwitcher variant="minimal" size="sm" />
        <button
          style={{
            padding: '0.5rem 1rem',
            background: '#0066ff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          登录
        </button>
      </div>
    </div>
  ),
};
