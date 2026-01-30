import type { Meta, StoryObj } from '@storybook/react';
import { Modal, ConfirmModal } from './Modal';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof Modal> = {
  title: 'Components/Common/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Modal 对话框组件，用于显示需要用户关注的内容或需要用户操作的表单。',
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
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
      description: '尺寸',
    },
    language: {
      control: 'radio',
      options: ['zh', 'en'],
      description: '语言',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

/** 基础用法 */
export const Default: Story = {
  render: () => {
    const ModalDemo = () => {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button
            onClick={() => setOpen(true)}
            style={{
              padding: '10px 20px',
              background: '#0066ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            打开对话框
          </button>
          <Modal
            open={open}
            title="对话框标题"
            onClose={() => setOpen(false)}
            onOk={() => {
              console.log('确认');
              setOpen(false);
            }}
          >
            <p>这是对话框的内容区域，可以放置任何内容。</p>
          </Modal>
        </>
      );
    };

    return <ModalDemo />;
  },
};

/** 不同尺寸 */
export const Sizes: Story = {
  render: () => {
    const SizeDemo = () => {
      const [size, setSize] = useState<'sm' | 'md' | 'lg' | 'xl' | null>(null);

      return (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                style={{
                  padding: '8px 16px',
                  background: '#0066ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
          <Modal
            open={!!size}
            title={`${size?.toUpperCase()} 尺寸对话框`}
            size={size || 'md'}
            onClose={() => setSize(null)}
            onOk={() => setSize(null)}
          >
            <p>这是 {size?.toUpperCase()} 尺寸的对话框。</p>
            <p>不同尺寸适用于不同的内容场景。</p>
          </Modal>
        </>
      );
    };

    return <SizeDemo />;
  },
};

/** 自定义页脚 */
export const CustomFooter: Story = {
  render: () => {
    const CustomFooterDemo = () => {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button
            onClick={() => setOpen(true)}
            style={{
              padding: '10px 20px',
              background: '#0066ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            自定义页脚
          </button>
          <Modal
            open={open}
            title="自定义页脚"
            onClose={() => setOpen(false)}
            footer={
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#f3f4f6',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  稍后再说
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  立即购买
                </button>
              </div>
            }
          >
            <p>可以完全自定义页脚区域的内容。</p>
          </Modal>
        </>
      );
    };

    return <CustomFooterDemo />;
  },
};

/** 无页脚 */
export const NoFooter: Story = {
  render: () => {
    const NoFooterDemo = () => {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button
            onClick={() => setOpen(true)}
            style={{
              padding: '10px 20px',
              background: '#0066ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            无页脚对话框
          </button>
          <Modal
            open={open}
            title="信息展示"
            hideFooter
            onClose={() => setOpen(false)}
          >
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
              <h3 style={{ margin: '0 0 0.5rem' }}>恭喜您！</h3>
              <p style={{ margin: 0, color: '#666' }}>您已成功完成注册</p>
            </div>
          </Modal>
        </>
      );
    };

    return <NoFooterDemo />;
  },
};

/** 加载状态 */
export const Loading: Story = {
  render: () => {
    const LoadingDemo = () => {
      const [open, setOpen] = useState(false);
      const [loading, setLoading] = useState(false);

      const handleOk = () => {
        setLoading(true);
        setTimeout(() => {
          setLoading(false);
          setOpen(false);
        }, 2000);
      };

      return (
        <>
          <button
            onClick={() => setOpen(true)}
            style={{
              padding: '10px 20px',
              background: '#0066ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            提交表单
          </button>
          <Modal
            open={open}
            title="提交确认"
            confirmLoading={loading}
            onClose={() => setOpen(false)}
            onOk={handleOk}
          >
            <p>点击确认将提交表单，模拟 2 秒加载状态。</p>
          </Modal>
        </>
      );
    };

    return <LoadingDemo />;
  },
};

/** 确认对话框 */
export const Confirm: Story = {
  render: () => {
    const ConfirmDemo = () => {
      const [type, setType] = useState<'info' | 'success' | 'warning' | 'danger' | null>(null);

      const configs = {
        info: {
          title: '提示',
          message: '这是一条信息确认提示。',
        },
        success: {
          title: '成功',
          message: '操作已成功完成，是否继续？',
        },
        warning: {
          title: '警告',
          message: '此操作可能会影响现有数据，是否继续？',
        },
        danger: {
          title: '危险操作',
          message: '此操作不可撤销，确定要删除吗？',
        },
      };

      return (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['info', 'success', 'warning', 'danger'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '8px 16px',
                  background: t === 'info' ? '#0066ff' : t === 'success' ? '#10b981' : t === 'warning' ? '#f59e0b' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {type && (
            <ConfirmModal
              open={true}
              type={type}
              title={configs[type].title}
              message={configs[type].message}
              okText={type === 'danger' ? '删除' : '确定'}
              onConfirm={() => {
                console.log('Confirmed:', type);
                setType(null);
              }}
              onCancel={() => setType(null)}
            />
          )}
        </>
      );
    };

    return <ConfirmDemo />;
  },
};

/** 长内容滚动 */
export const Scrollable: Story = {
  render: () => {
    const ScrollDemo = () => {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button
            onClick={() => setOpen(true)}
            style={{
              padding: '10px 20px',
              background: '#0066ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            长内容对话框
          </button>
          <Modal
            open={open}
            title="服务条款"
            onClose={() => setOpen(false)}
            onOk={() => setOpen(false)}
            okText="我已阅读并同意"
          >
            <div style={{ lineHeight: 1.8 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <p key={i}>
                  第 {i + 1} 条：这是服务条款的内容，请仔细阅读。本条款包含重要的法律信息，
                  涉及您使用我们服务的权利和义务。我们保留随时修改这些条款的权利，
                  修改后的条款将在网站上公布后立即生效。
                </p>
              ))}
            </div>
          </Modal>
        </>
      );
    };

    return <ScrollDemo />;
  },
};

/** 英文版本 */
export const EnglishVersion: Story = {
  render: () => {
    const EnglishDemo = () => {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button
            onClick={() => setOpen(true)}
            style={{
              padding: '10px 20px',
              background: '#0066ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            English Modal
          </button>
          <Modal
            open={open}
            title="确认订单"
            titleEn="Confirm Order"
            language="en"
            onClose={() => setOpen(false)}
            onOk={() => setOpen(false)}
          >
            <p>Please confirm your order details before proceeding.</p>
          </Modal>
        </>
      );
    };

    return <EnglishDemo />;
  },
};
