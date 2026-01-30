import type { Meta, StoryObj } from '@storybook/react';
import { Loading, CardSkeleton, ListSkeleton } from './Loading';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof Loading> = {
  title: 'Components/Common/Loading',
  component: Loading,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '加载状态组件，支持多种样式：转圈、点状、骨架屏、脉冲等。',
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
    type: {
      control: 'select',
      options: ['spinner', 'dots', 'skeleton', 'pulse'],
      description: '加载类型',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg', 'xl'],
      description: '尺寸',
    },
    color: {
      control: 'select',
      options: ['primary', 'white', 'gray'],
      description: '颜色',
    },
    fullscreen: {
      control: 'boolean',
      description: '是否全屏',
    },
    showText: {
      control: 'boolean',
      description: '是否显示文字',
    },
    text: {
      control: 'text',
      description: '自定义文字',
    },
    skeletonLines: {
      control: { type: 'number', min: 1, max: 10 },
      description: '骨架屏行数',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Loading>;

/** 转圈加载（默认） */
export const Spinner: Story = {
  args: {
    type: 'spinner',
    size: 'md',
    color: 'primary',
    showText: true,
  },
};

/** 点状加载 */
export const Dots: Story = {
  args: {
    type: 'dots',
    size: 'md',
    color: 'primary',
    showText: true,
  },
};

/** 脉冲加载 */
export const Pulse: Story = {
  args: {
    type: 'pulse',
    size: 'md',
    color: 'primary',
    showText: true,
  },
};

/** 骨架屏 */
export const Skeleton: Story = {
  args: {
    type: 'skeleton',
    skeletonLines: 4,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '300px' }}>
        <Story />
      </div>
    ),
  ],
};

/** 不同尺寸 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-end' }}>
      <div style={{ textAlign: 'center' }}>
        <Loading size="sm" showText={false} />
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
          Small
        </p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading size="md" showText={false} />
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
          Medium
        </p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading size="lg" showText={false} />
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
          Large
        </p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading size="xl" showText={false} />
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
          Extra Large
        </p>
      </div>
    </div>
  ),
};

/** 不同颜色 */
export const Colors: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <Loading color="primary" showText={false} />
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
          Primary
        </p>
      </div>
      <div
        style={{
          textAlign: 'center',
          background: '#1a1a2e',
          padding: '1rem',
          borderRadius: '8px',
        }}
      >
        <Loading color="white" showText={false} />
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'white' }}>
          White
        </p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading color="gray" showText={false} />
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
          Gray
        </p>
      </div>
    </div>
  ),
};

/** 自定义文字 */
export const CustomText: Story = {
  args: {
    type: 'spinner',
    text: '正在加载数据...',
  },
};

/** 无文字 */
export const NoText: Story = {
  args: {
    type: 'spinner',
    showText: false,
  },
};

/** 全屏加载 */
export const Fullscreen: Story = {
  args: {
    fullscreen: true,
    text: '页面加载中...',
  },
  parameters: {
    layout: 'fullscreen',
  },
};

/** 卡片骨架屏 */
export const CardSkeletonStory: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 280px)',
        gap: '1rem',
      }}
    >
      <CardSkeleton count={3} />
    </div>
  ),
  name: 'Card Skeleton',
};

/** 列表骨架屏 */
export const ListSkeletonStory: Story = {
  render: () => (
    <div style={{ width: '400px' }}>
      <ListSkeleton count={4} showAvatar={true} />
    </div>
  ),
  name: 'List Skeleton',
};

/** 在按钮中使用 */
export const InButton: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1.5rem',
          background: '#0066ff',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          cursor: 'wait',
        }}
      >
        <Loading type="spinner" size="sm" color="white" showText={false} />
        提交中...
      </button>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1.5rem',
          background: 'transparent',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          color: '#64748b',
          cursor: 'wait',
        }}
      >
        <Loading type="dots" size="sm" color="gray" showText={false} />
        加载中
      </button>
    </div>
  ),
};

/** 在卡片中使用 */
export const InCard: Story = {
  render: () => (
    <div
      style={{
        width: '300px',
        padding: '2rem',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center',
      }}
    >
      <Loading size="lg" text="正在获取数据..." />
    </div>
  ),
};
