import type { Meta, StoryObj } from '@storybook/react';
import { Pagination } from './Pagination';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

const meta: Meta<typeof Pagination> = {
  title: 'Components/Common/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '分页组件，用于长列表数据的分页展示。',
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
      control: 'radio',
      options: ['sm', 'md', 'lg'],
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
type Story = StoryObj<typeof Pagination>;

/** 基础用法 */
export const Default: Story = {
  render: () => {
    const PaginationDemo = () => {
      const [current, setCurrent] = useState(1);

      return (
        <Pagination
          current={current}
          total={256}
          onChange={(page) => setCurrent(page)}
        />
      );
    };

    return <PaginationDemo />;
  },
};

/** 带快速跳转 */
export const WithQuickJumper: Story = {
  render: () => {
    const PaginationDemo = () => {
      const [current, setCurrent] = useState(1);

      return (
        <Pagination
          current={current}
          total={500}
          showQuickJumper
          onChange={(page) => setCurrent(page)}
        />
      );
    };

    return <PaginationDemo />;
  },
};

/** 带每页条数选择 */
export const WithSizeChanger: Story = {
  render: () => {
    const PaginationDemo = () => {
      const [current, setCurrent] = useState(1);
      const [pageSize, setPageSize] = useState(10);

      return (
        <Pagination
          current={current}
          total={256}
          pageSize={pageSize}
          showSizeChanger
          onChange={(page, size) => {
            setCurrent(page);
            setPageSize(size);
          }}
        />
      );
    };

    return <PaginationDemo />;
  },
};

/** 完整功能 */
export const FullFeatured: Story = {
  render: () => {
    const PaginationDemo = () => {
      const [current, setCurrent] = useState(5);
      const [pageSize, setPageSize] = useState(20);

      return (
        <Pagination
          current={current}
          total={1000}
          pageSize={pageSize}
          showTotal
          showSizeChanger
          showQuickJumper
          pageSizeOptions={[10, 20, 50, 100]}
          onChange={(page, size) => {
            setCurrent(page);
            setPageSize(size);
          }}
        />
      );
    };

    return <PaginationDemo />;
  },
};

/** 少量页码 */
export const FewPages: Story = {
  render: () => {
    const PaginationDemo = () => {
      const [current, setCurrent] = useState(1);

      return (
        <Pagination
          current={current}
          total={45}
          pageSize={10}
          onChange={(page) => setCurrent(page)}
        />
      );
    };

    return <PaginationDemo />;
  },
};

/** 单页 */
export const SinglePage: Story = {
  args: {
    current: 1,
    total: 8,
    pageSize: 10,
  },
};

/** 小尺寸 */
export const Small: Story = {
  render: () => {
    const PaginationDemo = () => {
      const [current, setCurrent] = useState(1);

      return (
        <Pagination
          current={current}
          total={256}
          size="sm"
          onChange={(page) => setCurrent(page)}
        />
      );
    };

    return <PaginationDemo />;
  },
};

/** 大尺寸 */
export const Large: Story = {
  render: () => {
    const PaginationDemo = () => {
      const [current, setCurrent] = useState(1);

      return (
        <Pagination
          current={current}
          total={256}
          size="lg"
          onChange={(page) => setCurrent(page)}
        />
      );
    };

    return <PaginationDemo />;
  },
};

/** 禁用状态 */
export const Disabled: Story = {
  args: {
    current: 5,
    total: 256,
    disabled: true,
  },
};

/** 隐藏总条数 */
export const NoTotal: Story = {
  render: () => {
    const PaginationDemo = () => {
      const [current, setCurrent] = useState(1);

      return (
        <Pagination
          current={current}
          total={256}
          showTotal={false}
          onChange={(page) => setCurrent(page)}
        />
      );
    };

    return <PaginationDemo />;
  },
};

/** 英文版本 */
export const EnglishVersion: Story = {
  render: () => {
    const PaginationDemo = () => {
      const [current, setCurrent] = useState(5);
      const [pageSize, setPageSize] = useState(20);

      return (
        <Pagination
          current={current}
          total={500}
          pageSize={pageSize}
          showTotal
          showSizeChanger
          showQuickJumper
          language="en"
          onChange={(page, size) => {
            setCurrent(page);
            setPageSize(size);
          }}
        />
      );
    };

    return <PaginationDemo />;
  },
};

/** 自定义每页选项 */
export const CustomPageSizes: Story = {
  render: () => {
    const PaginationDemo = () => {
      const [current, setCurrent] = useState(1);
      const [pageSize, setPageSize] = useState(15);

      return (
        <Pagination
          current={current}
          total={300}
          pageSize={pageSize}
          showSizeChanger
          pageSizeOptions={[15, 30, 60, 150]}
          onChange={(page, size) => {
            setCurrent(page);
            setPageSize(size);
          }}
        />
      );
    };

    return <PaginationDemo />;
  },
};
