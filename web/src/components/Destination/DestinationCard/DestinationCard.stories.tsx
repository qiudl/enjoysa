import type { Meta, StoryObj } from '@storybook/react';
import { DestinationCard } from './DestinationCard';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import type { Destination } from '../../../types';

const mockDestinations: Destination[] = [
  {
    id: '1',
    name: '袋鼠岛',
    nameEn: 'Kangaroo Island',
    region: '南澳',
    regionEn: 'South Australia',
    description: '澳大利亚最著名的野生动物天堂，拥有原始的自然景观和丰富的野生动物。',
    descriptionEn: "Australia's most famous wildlife paradise with pristine natural landscapes and abundant wildlife.",
  },
  {
    id: '2',
    name: '巴罗萨谷',
    nameEn: 'Barossa Valley',
    region: '南澳',
    regionEn: 'South Australia',
    description: '世界知名的葡萄酒产区，拥有超过150年的酿酒历史和众多获奖酒庄。',
    descriptionEn: 'World-renowned wine region with over 150 years of winemaking history and numerous award-winning wineries.',
  },
  {
    id: '3',
    name: '阿德莱德市区',
    nameEn: 'Adelaide City',
    region: '南澳',
    regionEn: 'South Australia',
    description: '南澳大利亚的首府，融合了优雅的殖民建筑、美食文化和现代都市魅力。',
    descriptionEn: 'Capital of South Australia, blending elegant colonial architecture, food culture, and modern urban charm.',
  },
  {
    id: '4',
    name: '弗林德斯山脉',
    nameEn: 'Flinders Ranges',
    region: '南澳',
    regionEn: 'South Australia',
    description: '拥有6亿年历史的古老山脉，是澳大利亚最壮观的内陆景观之一。',
    descriptionEn: 'Ancient mountain ranges with 600 million years of history, one of Australia\'s most spectacular outback landscapes.',
  },
  {
    id: '5',
    name: '艾尔半岛',
    nameEn: 'Eyre Peninsula',
    region: '南澳',
    regionEn: 'South Australia',
    description: '海鲜爱好者的天堂，可以与海狮共泳、品尝新鲜生蚝。',
    descriptionEn: 'Seafood lover\'s paradise where you can swim with sea lions and taste fresh oysters.',
  },
];

const meta: Meta<typeof DestinationCard> = {
  title: 'Components/Destination/DestinationCard',
  component: DestinationCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '目的地卡片组件，展示旅游目的地信息，支持多种变体。',
      },
    },
    backgrounds: {
      default: 'gray',
      values: [
        { name: 'gray', value: '#f7fafc' },
        { name: 'white', value: '#ffffff' },
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
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'compact', 'featured'],
      description: '卡片变体',
    },
    productCount: {
      control: { type: 'number', min: 0, max: 500 },
      description: '产品数量',
    },
    language: {
      control: 'radio',
      options: ['zh', 'en'],
      description: '语言',
    },
  },
};

export default meta;
type Story = StoryObj<typeof DestinationCard>;

/** 默认目的地卡片 */
export const Default: Story = {
  args: {
    destination: mockDestinations[0],
    productCount: 42,
    onClick: (dest) => console.log('Clicked:', dest.name),
  },
  decorators: [
    (Story) => (
      <div style={{ width: '320px' }}>
        <Story />
      </div>
    ),
  ],
};

/** 紧凑变体 */
export const Compact: Story = {
  args: {
    ...Default.args,
    variant: 'compact',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '240px' }}>
        <Story />
      </div>
    ),
  ],
};

/** 精选变体 */
export const Featured: Story = {
  args: {
    ...Default.args,
    variant: 'featured',
    productCount: 86,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    ),
  ],
};

/** 英文版本 */
export const EnglishVersion: Story = {
  args: {
    ...Default.args,
    language: 'en',
  },
  decorators: [
    (Story) => {
      i18n.changeLanguage('en');
      return (
        <div style={{ width: '320px' }}>
          <I18nextProvider i18n={i18n}>
            <Story />
          </I18nextProvider>
        </div>
      );
    },
  ],
};

/** 目的地网格 */
export const DestinationGrid: Story = {
  render: () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 300px)',
      gap: '1.5rem',
    }}>
      {mockDestinations.slice(0, 3).map((dest) => (
        <DestinationCard
          key={dest.id}
          destination={dest}
          productCount={Math.floor(Math.random() * 100) + 10}
          onClick={(d) => console.log('Clicked:', d.name)}
        />
      ))}
    </div>
  ),
};

/** 精选目的地展示 */
export const FeaturedShowcase: Story = {
  render: () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1.5rem',
      width: '800px',
    }}>
      <div style={{ gridColumn: '1 / 3' }}>
        <DestinationCard
          destination={mockDestinations[0]}
          variant="featured"
          productCount={86}
          onClick={(d) => console.log('Clicked:', d.name)}
        />
      </div>
      {mockDestinations.slice(1, 5).map((dest) => (
        <DestinationCard
          key={dest.id}
          destination={dest}
          productCount={Math.floor(Math.random() * 60) + 10}
          onClick={(d) => console.log('Clicked:', d.name)}
        />
      ))}
    </div>
  ),
};

/** 紧凑网格 */
export const CompactGrid: Story = {
  render: () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 200px)',
      gap: '1rem',
    }}>
      {mockDestinations.map((dest) => (
        <DestinationCard
          key={dest.id}
          destination={dest}
          variant="compact"
          productCount={Math.floor(Math.random() * 50) + 5}
          onClick={(d) => console.log('Clicked:', d.name)}
        />
      ))}
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
  decorators: [
    (Story) => (
      <div style={{ width: '100%', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
};
