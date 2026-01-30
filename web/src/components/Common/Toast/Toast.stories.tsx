import type { Meta, StoryObj } from '@storybook/react';
import { Toast, ToastContainer } from './Toast';
import type { ToastItem } from './Toast';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof Toast> = {
  title: 'Components/Common/Toast',
  component: Toast,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Toast 通知组件，用于显示操作反馈和系统消息。',
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
      options: ['success', 'error', 'warning', 'info'],
      description: '类型',
    },
    position: {
      control: 'select',
      options: ['top', 'top-right', 'top-left', 'bottom', 'bottom-right', 'bottom-left'],
      description: '位置',
    },
    duration: {
      control: 'number',
      description: '持续时间(ms)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Toast>;

/** 成功提示 */
export const Success: Story = {
  args: {
    type: 'success',
    title: '操作成功',
    message: '您的订单已成功提交，请等待确认。',
    duration: 0,
  },
};

/** 错误提示 */
export const Error: Story = {
  args: {
    type: 'error',
    title: '操作失败',
    message: '网络连接异常，请检查网络设置后重试。',
    duration: 0,
  },
};

/** 警告提示 */
export const Warning: Story = {
  args: {
    type: 'warning',
    title: '注意',
    message: '您的账户余额不足，请及时充值。',
    duration: 0,
  },
};

/** 信息提示 */
export const Info: Story = {
  args: {
    type: 'info',
    title: '提示',
    message: '系统将于今晚 23:00-24:00 进行维护，届时无法访问。',
    duration: 0,
  },
};

/** 无标题 */
export const NoTitle: Story = {
  args: {
    type: 'success',
    message: '保存成功！',
    duration: 0,
  },
};

/** 长文本 */
export const LongMessage: Story = {
  args: {
    type: 'info',
    title: '服务条款更新',
    message: '我们更新了服务条款和隐私政策。继续使用我们的服务即表示您同意这些更新。如有任何疑问，请联系客服。',
    duration: 0,
  },
};

/** 不可关闭 */
export const NotClosable: Story = {
  args: {
    type: 'warning',
    message: '正在处理中，请稍候...',
    closable: false,
    duration: 0,
  },
};

/** 自动关闭 (3秒) */
export const AutoClose: Story = {
  args: {
    type: 'success',
    message: '此提示将在 3 秒后自动关闭',
    duration: 3000,
  },
};

/** Toast 容器演示 */
export const ToastContainerDemo: Story = {
  render: () => {
    const ToastDemo = () => {
      const [toasts, setToasts] = useState<ToastItem[]>([]);
      let idCounter = 0;

      const addToast = (type: 'success' | 'error' | 'warning' | 'info') => {
        const messages = {
          success: '操作成功完成！',
          error: '操作失败，请重试。',
          warning: '请注意，此操作不可撤销。',
          info: '这是一条信息提示。',
        };

        const newToast: ToastItem = {
          id: `toast-${Date.now()}-${idCounter++}`,
          type,
          message: messages[type],
          duration: 3000,
        };

        setToasts((prev) => [...prev, newToast]);
      };

      const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      };

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <p style={{ color: '#666', fontSize: '14px' }}>点击按钮添加 Toast 通知</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => addToast('success')}
              style={{
                padding: '8px 16px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              成功
            </button>
            <button
              onClick={() => addToast('error')}
              style={{
                padding: '8px 16px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              错误
            </button>
            <button
              onClick={() => addToast('warning')}
              style={{
                padding: '8px 16px',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              警告
            </button>
            <button
              onClick={() => addToast('info')}
              style={{
                padding: '8px 16px',
                background: '#0066ff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              信息
            </button>
          </div>
          <ToastContainer
            toasts={toasts}
            position="top-right"
            onRemove={removeToast}
          />
        </div>
      );
    };

    return <ToastDemo />;
  },
};

/** 所有类型 */
export const AllTypes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Toast type="success" title="成功" message="操作已成功完成" duration={0} />
      <Toast type="error" title="错误" message="操作失败，请重试" duration={0} />
      <Toast type="warning" title="警告" message="请注意潜在风险" duration={0} />
      <Toast type="info" title="提示" message="这是一条信息提示" duration={0} />
    </div>
  ),
};
