import type { Meta, StoryObj } from '@storybook/react';
import { Header } from './Header';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof Header> = {
  title: 'Components/Common/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '网站顶部导航栏组件，包含Logo、导航菜单、搜索、语言切换、用户菜单等功能。',
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
    isLoggedIn: {
      control: 'boolean',
      description: '是否已登录',
    },
    cartCount: {
      control: { type: 'number', min: 0, max: 99 },
      description: '购物车数量',
    },
    favoriteCount: {
      control: { type: 'number', min: 0, max: 99 },
      description: '收藏数量',
    },
    sticky: {
      control: 'boolean',
      description: '是否固定在顶部',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Header>;

/** 未登录状态 */
export const LoggedOut: Story = {
  args: {
    isLoggedIn: false,
    onNavClick: (path) => console.log('Navigate to:', path),
    onLoginClick: () => console.log('Login clicked'),
    onRegisterClick: () => console.log('Register clicked'),
    onSearch: (keyword) => console.log('Search:', keyword),
  },
};

/** 已登录状态 */
export const LoggedIn: Story = {
  args: {
    isLoggedIn: true,
    userName: '张三',
    cartCount: 3,
    favoriteCount: 5,
    onNavClick: (path) => console.log('Navigate to:', path),
    onSearch: (keyword) => console.log('Search:', keyword),
  },
};

/** 带头像的已登录状态 */
export const WithAvatar: Story = {
  args: {
    isLoggedIn: true,
    userName: '张三',
    userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    cartCount: 2,
    favoriteCount: 8,
    onNavClick: (path) => console.log('Navigate to:', path),
  },
};

/** 固定在顶部 */
export const Sticky: Story = {
  args: {
    ...LoggedIn.args,
    sticky: true,
  },
  render: (args) => (
    <div style={{ height: '200vh' }}>
      <Header {...args} />
      <div style={{ padding: '2rem' }}>
        <p>向下滚动查看固定效果</p>
        {Array(20)
          .fill(0)
          .map((_, i) => (
            <p key={i} style={{ margin: '2rem 0' }}>
              这是一些示例内容，用于展示滚动效果。段落 {i + 1}
            </p>
          ))}
      </div>
    </div>
  ),
};

/** 自定义 Logo */
export const WithCustomLogo: Story = {
  args: {
    ...LoggedOut.args,
    logo: 'https://via.placeholder.com/120x36?text=EnjoySA',
  },
};

/** 移动端视图 */
export const MobileView: Story = {
  args: {
    ...LoggedIn.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/** 与页面内容组合 */
export const WithPageContent: Story = {
  args: {
    ...LoggedIn.args,
    sticky: true,
  },
  render: (args) => (
    <div>
      <Header {...args} />
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <section style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>探索南澳大利亚</h1>
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            发现阿德莱德和南澳大利亚的精彩旅程，从袋鼠岛的野生动物到巴罗莎谷的醇美葡萄酒。
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>热门目的地</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
            }}
          >
            {['袋鼠岛', '巴罗莎谷', '阿德莱德市区', '维克多港'].map((name) => (
              <div
                key={name}
                style={{
                  padding: '1.5rem',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                {name}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  ),
};
