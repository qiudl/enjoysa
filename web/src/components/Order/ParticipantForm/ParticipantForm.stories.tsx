import type { Meta, StoryObj } from '@storybook/react';
import { ParticipantForm } from './ParticipantForm';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import { useState } from 'react';
import type { ParticipantDetail } from '../../../types';

const emptyParticipant: ParticipantDetail = {
  id: 'p-1',
  type: 'adult',
  firstName: '',
  lastName: '',
};

const filledParticipant: ParticipantDetail = {
  id: 'p-1',
  type: 'adult',
  firstName: '东林',
  lastName: '邱',
  email: 'donglin@example.com',
  phone: '+61 400 123 456',
  specialRequirements: '素食',
};

const meta: Meta<typeof ParticipantForm> = {
  title: 'Components/Order/ParticipantForm',
  component: ParticipantForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '参与者表单组件，用于收集旅行参与者的个人信息。',
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
        <div style={{ width: '600px' }}>
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  argTypes: {
    maxParticipants: {
      control: { type: 'number', min: 1, max: 20 },
      description: '最大参与者数量',
    },
    minParticipants: {
      control: { type: 'number', min: 1, max: 5 },
      description: '最小参与者数量',
    },
    readonly: {
      control: 'boolean',
      description: '是否只读',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ParticipantForm>;

/** 默认空表单 */
export const Default: Story = {
  args: {
    participants: [emptyParticipant],
    onChange: (participants) => console.log('Participants:', participants),
  },
};

/** 已填写信息 */
export const WithData: Story = {
  args: {
    participants: [filledParticipant],
    onChange: (participants) => console.log('Participants:', participants),
  },
};

/** 多个参与者 */
export const MultipleParticipants: Story = {
  args: {
    participants: [
      { ...filledParticipant, id: 'p-1' },
      {
        id: 'p-2',
        type: 'adult' as const,
        firstName: '小明',
        lastName: '王',
        email: 'xiaoming@example.com',
        phone: '+61 400 234 567',
      },
      {
        id: 'p-3',
        type: 'child' as const,
        firstName: '',
        lastName: '',
      },
    ],
    maxParticipants: 5,
    onChange: (participants) => console.log('Participants:', participants),
  },
};

/** 交互式表单 */
export const Interactive: Story = {
  render: () => {
    const [participants, setParticipants] = useState<ParticipantDetail[]>([
      { id: 'p-1', type: 'adult', firstName: '', lastName: '' },
    ]);

    return (
      <div>
        <ParticipantForm
          participants={participants}
          onChange={setParticipants}
          maxParticipants={5}
          minParticipants={1}
        />
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#f5f5f5',
          borderRadius: '8px',
          fontSize: '14px',
        }}>
          <strong>当前数据:</strong>
          <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
            {JSON.stringify(participants, null, 2)}
          </pre>
        </div>
      </div>
    );
  },
};

/** 只读模式 */
export const Readonly: Story = {
  args: {
    participants: [filledParticipant],
    readonly: true,
  },
};

/** 达到上限 */
export const MaxReached: Story = {
  args: {
    participants: [
      { ...filledParticipant, id: 'p-1' },
      { id: 'p-2', type: 'adult' as const, firstName: '小明', lastName: '王' },
      { id: 'p-3', type: 'child' as const, firstName: '小红', lastName: '李' },
    ],
    maxParticipants: 3,
    onChange: (participants) => console.log('Participants:', participants),
  },
};

/** 英文版本 */
export const EnglishVersion: Story = {
  args: {
    participants: [{
      id: 'p-1',
      type: 'adult' as const,
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      phone: '+1 555 123 4567',
    }],
    onChange: (participants) => console.log('Participants:', participants),
  },
  decorators: [
    (Story) => {
      i18n.changeLanguage('en');
      return (
        <div style={{ width: '600px' }}>
          <I18nextProvider i18n={i18n}>
            <Story />
          </I18nextProvider>
        </div>
      );
    },
  ],
};

/** 移动端视图 */
export const MobileView: Story = {
  args: {
    participants: [filledParticipant],
    onChange: (participants) => console.log('Participants:', participants),
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
