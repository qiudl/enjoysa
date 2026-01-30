import type { Meta, StoryObj } from '@storybook/react';
import { StatCard } from './StatCard';
import { Users, ShoppingCart, DollarSign, Package, TrendingUp, Eye } from 'lucide-react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof StatCard> = {
  title: 'Components/Admin/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '统计卡片组件，用于管理后台展示关键数据指标。',
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
        <div style={{ width: '280px' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'warning', 'danger'],
      description: '变体样式',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
      description: '尺寸',
    },
    trend: {
      control: 'select',
      options: ['up', 'down', 'neutral', undefined],
      description: '趋势方向',
    },
    language: {
      control: 'radio',
      options: ['zh', 'en'],
      description: '语言',
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatCard>;

/** 默认样式 */
export const Default: Story = {
  args: {
    title: '总用户数',
    titleEn: 'Total Users',
    value: '12,345',
    icon: <Users size={24} />,
    trend: 'up',
    trendValue: '+12.5%',
    trendLabel: '较上月',
    trendLabelEn: 'vs last month',
  },
};

/** 主要样式 */
export const Primary: Story = {
  args: {
    title: '今日订单',
    titleEn: 'Today Orders',
    value: 256,
    icon: <ShoppingCart size={24} />,
    variant: 'primary',
    trend: 'up',
    trendValue: '+8.3%',
    trendLabel: '较昨日',
    trendLabelEn: 'vs yesterday',
  },
};

/** 成功样式 */
export const Success: Story = {
  args: {
    title: '成交金额',
    titleEn: 'Revenue',
    value: '¥89,432',
    icon: <DollarSign size={24} />,
    variant: 'success',
    trend: 'up',
    trendValue: '+23.1%',
    trendLabel: '较上周',
    trendLabelEn: 'vs last week',
  },
};

/** 警告样式 */
export const Warning: Story = {
  args: {
    title: '待处理订单',
    titleEn: 'Pending Orders',
    value: 42,
    icon: <Package size={24} />,
    variant: 'warning',
    trend: 'down',
    trendValue: '-5.2%',
    trendLabel: '较昨日',
    trendLabelEn: 'vs yesterday',
  },
};

/** 危险样式 */
export const Danger: Story = {
  args: {
    title: '退款申请',
    titleEn: 'Refund Requests',
    value: 8,
    icon: <TrendingUp size={24} />,
    variant: 'danger',
    trend: 'up',
    trendValue: '+3',
    trendLabel: '今日新增',
    trendLabelEn: 'new today',
  },
};

/** 无图标 */
export const NoIcon: Story = {
  args: {
    title: '页面浏览量',
    titleEn: 'Page Views',
    value: '45,678',
    trend: 'up',
    trendValue: '+15.8%',
    trendLabel: '较上周',
    trendLabelEn: 'vs last week',
  },
};

/** 带单位 */
export const WithUnit: Story = {
  args: {
    title: '平均响应时间',
    titleEn: 'Avg Response Time',
    value: '1.2',
    unit: '秒',
    icon: <Eye size={24} />,
    trend: 'down',
    trendValue: '-0.3s',
    trendLabel: '较上周',
    trendLabelEn: 'vs last week',
  },
};

/** 中性趋势 */
export const NeutralTrend: Story = {
  args: {
    title: '活跃供应商',
    titleEn: 'Active Suppliers',
    value: 156,
    icon: <Users size={24} />,
    trend: 'neutral',
    trendValue: '0%',
    trendLabel: '无变化',
    trendLabelEn: 'no change',
  },
};

/** 小尺寸 */
export const Small: Story = {
  args: {
    ...Default.args,
    size: 'sm',
  },
};

/** 大尺寸 */
export const Large: Story = {
  args: {
    ...Default.args,
    size: 'lg',
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <div style={{ width: '360px' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
};

/** 加载中 */
export const Loading: Story = {
  args: {
    title: '加载中',
    value: '',
    loading: true,
  },
};

/** 可点击 */
export const Clickable: Story = {
  args: {
    ...Default.args,
    onClick: () => alert('Card clicked!'),
  },
};

/** 统计卡片组 */
export const StatCardsGrid: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 260px)', gap: '1rem' }}>
      <StatCard
        title="总用户数"
        titleEn="Total Users"
        value="12,345"
        icon={<Users size={24} />}
        trend="up"
        trendValue="+12.5%"
        trendLabel="较上月"
      />
      <StatCard
        title="今日订单"
        titleEn="Today Orders"
        value={256}
        icon={<ShoppingCart size={24} />}
        variant="primary"
        trend="up"
        trendValue="+8.3%"
        trendLabel="较昨日"
      />
      <StatCard
        title="成交金额"
        titleEn="Revenue"
        value="¥89,432"
        icon={<DollarSign size={24} />}
        variant="success"
        trend="up"
        trendValue="+23.1%"
        trendLabel="较上周"
      />
      <StatCard
        title="待处理订单"
        titleEn="Pending Orders"
        value={42}
        icon={<Package size={24} />}
        variant="warning"
        trend="down"
        trendValue="-5.2%"
        trendLabel="较昨日"
      />
    </div>
  ),
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <div style={{ width: 'auto' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
};

/** 英文版本 */
export const EnglishVersion: Story = {
  args: {
    ...Default.args,
    language: 'en',
  },
};
