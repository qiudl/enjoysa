import type { Meta, StoryObj } from '@storybook/react';
import { Footer } from './Footer';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof Footer> = {
  title: 'Components/Common/Footer',
  component: Footer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '网站底部组件，包含公司信息、快速链接、客服信息、社交媒体等。',
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
    phone: {
      control: 'text',
      description: '联系电话',
    },
    email: {
      control: 'text',
      description: '联系邮箱',
    },
    wechat: {
      control: 'text',
      description: '微信公众号',
    },
    address: {
      control: 'text',
      description: '地址',
    },
    icp: {
      control: 'text',
      description: 'ICP 备案号',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Footer>;

/** 默认状态 */
export const Default: Story = {
  args: {
    onNavClick: (path) => console.log('Navigate to:', path),
    onSocialClick: (platform) => console.log('Social:', platform),
  },
};

/** 带备案号 */
export const WithICP: Story = {
  args: {
    ...Default.args,
    icp: '沪ICP备XXXXXXXX号-1',
  },
};

/** 自定义联系方式 */
export const CustomContact: Story = {
  args: {
    ...Default.args,
    phone: '+86 21 1234 5678',
    email: 'service@enjoysa.cn',
    wechat: 'EnjoySA_China',
    address: '上海市浦东新区陆家嘴',
  },
};

/** 自定义描述 */
export const CustomDescription: Story = {
  args: {
    ...Default.args,
    description:
      '畅游南澳是专注于南澳大利亚旅游的专业平台，为中国游客提供一站式旅游服务，包括精选旅游产品、酒店预订、接送服务等。我们致力于让每一位游客都能轻松体验南澳的独特魅力。',
  },
};

/** 与页面组合 */
export const WithPageContent: Story = {
  args: {
    ...Default.args,
  },
  render: (args) => (
    <div>
      <main
        style={{
          minHeight: '50vh',
          padding: '4rem 2rem',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>页面内容区域</h1>
        <p style={{ color: '#64748b', lineHeight: 1.6 }}>
          这里是页面的主要内容区域，Footer 组件位于页面底部。
        </p>
      </main>
      <Footer {...args} />
    </div>
  ),
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
