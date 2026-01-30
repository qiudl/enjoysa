import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { Heart, ShoppingCart, ArrowRight } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'Components/Common/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '通用按钮组件，支持多种变体、尺寸和状态。',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger', 'success'],
      description: '按钮变体样式',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg', 'xl'],
      description: '按钮尺寸',
    },
    fullWidth: {
      control: 'boolean',
      description: '是否为块级按钮',
    },
    loading: {
      control: 'boolean',
      description: '加载状态',
    },
    disabled: {
      control: 'boolean',
      description: '是否禁用',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

/** 默认按钮 */
export const Default: Story = {
  args: {
    children: '立即预订',
  },
};

/** 主要按钮 - 用于主要操作 */
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: '立即预订',
  },
};

/** 次要按钮 - 用于次要操作 */
export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: '查看详情',
  },
};

/** 轮廓按钮 - 用于可选操作 */
export const Outline: Story = {
  args: {
    variant: 'outline',
    children: '加入收藏',
  },
};

/** 幽灵按钮 - 用于文字链接风格 */
export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: '取消',
  },
};

/** 危险按钮 - 用于危险操作 */
export const Danger: Story = {
  args: {
    variant: 'danger',
    children: '删除订单',
  },
};

/** 成功按钮 - 用于确认操作 */
export const Success: Story = {
  args: {
    variant: 'success',
    children: '支付成功',
  },
};

/** 不同尺寸 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button size="sm">小号按钮</Button>
      <Button size="md">中号按钮</Button>
      <Button size="lg">大号按钮</Button>
      <Button size="xl">特大按钮</Button>
    </div>
  ),
};

/** 带图标的按钮 */
export const WithIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button leftIcon={<Heart size={18} />}>
        收藏
      </Button>
      <Button leftIcon={<ShoppingCart size={18} />}>
        加入购物车
      </Button>
      <Button rightIcon={<ArrowRight size={18} />}>
        下一步
      </Button>
    </div>
  ),
};

/** 加载状态 */
export const Loading: Story = {
  args: {
    loading: true,
    children: '处理中...',
  },
};

/** 禁用状态 */
export const Disabled: Story = {
  args: {
    disabled: true,
    children: '不可用',
  },
};

/** 块级按钮 */
export const FullWidth: Story = {
  render: () => (
    <div style={{ width: '300px' }}>
      <Button fullWidth>
        立即预订
      </Button>
    </div>
  ),
};

/** 按钮组合展示 */
export const ButtonGroup: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <Button variant="outline">
        取消
      </Button>
      <Button variant="primary">
        确认预订
      </Button>
    </div>
  ),
};

/** 所有变体对比 */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="success">Success</Button>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Button variant="primary" disabled>Primary</Button>
        <Button variant="secondary" disabled>Secondary</Button>
        <Button variant="outline" disabled>Outline</Button>
        <Button variant="ghost" disabled>Ghost</Button>
        <Button variant="danger" disabled>Danger</Button>
        <Button variant="success" disabled>Success</Button>
      </div>
    </div>
  ),
};
