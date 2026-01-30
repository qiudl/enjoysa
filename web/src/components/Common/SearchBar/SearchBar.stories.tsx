import type { Meta, StoryObj } from '@storybook/react';
import { SearchBar } from './SearchBar';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import { useState } from 'react';

const mockRecentSearches = ['袋鼠岛', '巴罗莎谷', '阿德莱德市区'];
const mockHotSearches = ['袋鼠岛一日游', '酒庄品酒', '海鲜之旅', '野生动物园', '日落游船'];

const meta: Meta<typeof SearchBar> = {
  title: 'Components/Common/SearchBar',
  component: SearchBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '搜索栏组件，支持最近搜索和热门搜索建议。',
      },
    },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <div style={{ width: '600px', padding: '2rem' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  argTypes: {
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
      description: '搜索栏尺寸',
    },
    autoFocus: {
      control: 'boolean',
      description: '是否自动聚焦',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SearchBar>;

/** 默认搜索栏 */
export const Default: Story = {
  args: {
    placeholder: '搜索目的地、景点、活动...',
    onSearch: (value) => console.log('Search:', value),
  },
};

/** 带搜索建议 */
export const WithSuggestions: Story = {
  args: {
    placeholder: '搜索目的地、景点、活动...',
    recentSearches: mockRecentSearches,
    hotSearches: mockHotSearches,
    onSearch: (value) => console.log('Search:', value),
    onClearRecentSearches: () => console.log('Clear recent searches'),
  },
};

/** 受控组件 */
export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <SearchBar
        value={value}
        onChange={setValue}
        onSearch={(v) => {
          console.log('Search:', v);
          alert(`搜索: ${v}`);
        }}
        recentSearches={mockRecentSearches}
        hotSearches={mockHotSearches}
      />
    );
  },
};

/** 不同尺寸 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <SearchBar size="sm" placeholder="小号搜索栏" />
      <SearchBar size="md" placeholder="中号搜索栏" />
      <SearchBar size="lg" placeholder="大号搜索栏" />
    </div>
  ),
};

/** 大号搜索栏（首页 Hero 使用） */
export const HeroSearchBar: Story = {
  args: {
    size: 'lg',
    placeholder: '搜索目的地、景点、活动...',
    recentSearches: mockRecentSearches,
    hotSearches: mockHotSearches,
    onSearch: (value) => console.log('Search:', value),
  },
  parameters: {
    backgrounds: {
      default: 'hero',
      values: [
        { name: 'hero', value: '#0077B6' },
      ],
    },
  },
};

/** 英文版本 */
export const EnglishVersion: Story = {
  args: {
    ...WithSuggestions.args,
  },
  decorators: [
    (Story) => {
      i18n.changeLanguage('en');
      return (
        <I18nextProvider i18n={i18n}>
          <div style={{ width: '600px', padding: '2rem' }}>
            <Story />
          </div>
        </I18nextProvider>
      );
    },
  ],
};

/** 移动端视图 */
export const MobileView: Story = {
  args: {
    ...WithSuggestions.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <div style={{ width: '100%', padding: '1rem' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
};
