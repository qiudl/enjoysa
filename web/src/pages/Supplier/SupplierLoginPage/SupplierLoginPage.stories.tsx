import type { Meta, StoryObj } from '@storybook/react';
import { SupplierLoginPage } from './SupplierLoginPage';

const meta: Meta<typeof SupplierLoginPage> = {
  title: 'Pages/Supplier/SupplierLoginPage',
  component: SupplierLoginPage,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    language: {
      control: 'radio',
      options: ['zh', 'en'],
    },
    onLoginSuccess: { action: 'loginSuccess' },
    onApplyClick: { action: 'applyClick' },
    onNavigateHome: { action: 'navigateHome' },
    onLanguageChange: { action: 'languageChange' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    language: 'zh',
  },
};

export const English: Story = {
  args: {
    language: 'en',
  },
};
