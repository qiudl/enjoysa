import type { Meta, StoryObj } from '@storybook/react';
import { ErrorBoundary, ErrorFallback } from './ErrorBoundary';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

// Component that throws an error
const BuggyComponent = () => {
  throw new Error('This is a test error from BuggyComponent');
};

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Components/Common/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'ErrorBoundary 错误边界组件，用于捕获子组件的 JavaScript 错误并显示友好的错误界面。',
      },
    },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <div style={{ width: '600px' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  argTypes: {
    language: {
      control: 'radio',
      options: ['zh', 'en'],
      description: '语言',
    },
    showDetails: {
      control: 'boolean',
      description: '是否显示错误详情',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

/** 错误状态 */
export const WithError: Story = {
  render: () => (
    <ErrorBoundary showDetails>
      <BuggyComponent />
    </ErrorBoundary>
  ),
};

/** 正常状态 */
export const NoError: Story = {
  render: () => (
    <ErrorBoundary>
      <div style={{ padding: '2rem', background: '#f0f4f8', borderRadius: '8px', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 1rem' }}>正常内容</h3>
        <p style={{ margin: 0, color: '#666' }}>当子组件正常时，ErrorBoundary 会正常渲染其内容。</p>
      </div>
    </ErrorBoundary>
  ),
};

/** 显示错误详情 */
export const WithDetails: Story = {
  render: () => (
    <ErrorBoundary showDetails language="zh">
      <BuggyComponent />
    </ErrorBoundary>
  ),
};

/** 英文版本 */
export const EnglishVersion: Story = {
  render: () => (
    <ErrorBoundary showDetails language="en">
      <BuggyComponent />
    </ErrorBoundary>
  ),
};

/** 自定义回退组件 */
export const CustomFallback: Story = {
  render: () => (
    <ErrorBoundary
      fallback={
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          color: 'white',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛠️</div>
          <h2 style={{ margin: '0 0 0.5rem' }}>自定义错误页面</h2>
          <p style={{ margin: 0, opacity: 0.8 }}>这是一个完全自定义的错误回退组件</p>
        </div>
      }
    >
      <BuggyComponent />
    </ErrorBoundary>
  ),
};

/** ErrorFallback 组件 */
export const FallbackComponent: Story = {
  render: () => (
    <ErrorFallback
      error={new Error('测试错误信息')}
      resetError={() => alert('重试按钮被点击')}
      language="zh"
    />
  ),
};

/** ErrorFallback 英文版 */
export const FallbackEnglish: Story = {
  render: () => (
    <ErrorFallback
      error={new Error('Test error message')}
      resetError={() => alert('Retry clicked')}
      language="en"
    />
  ),
};

/** 带错误回调 */
export const WithErrorCallback: Story = {
  render: () => (
    <ErrorBoundary
      showDetails
      onError={(error, errorInfo) => {
        console.log('Error caught:', error.message);
        console.log('Component stack:', errorInfo.componentStack);
        // 这里可以发送到错误监控服务
      }}
    >
      <BuggyComponent />
    </ErrorBoundary>
  ),
};

/** 嵌套 ErrorBoundary */
export const Nested: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <ErrorBoundary>
        <div style={{ padding: '1rem', background: '#e8f5e9', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 0.5rem' }}>组件 A - 正常</h4>
          <p style={{ margin: 0, fontSize: '14px' }}>这个组件正常工作</p>
        </div>
      </ErrorBoundary>
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
      <ErrorBoundary>
        <div style={{ padding: '1rem', background: '#e3f2fd', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 0.5rem' }}>组件 C - 正常</h4>
          <p style={{ margin: 0, fontSize: '14px' }}>即使 B 出错，C 仍然正常</p>
        </div>
      </ErrorBoundary>
    </div>
  ),
};
