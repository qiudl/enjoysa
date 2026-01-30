import type { Preview } from '@storybook/react-vite'
import { I18nextProvider } from 'react-i18next'
import i18n from '../src/i18n'
import React from 'react'

// 导入全局样式
import '../src/index.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#FFFFFF' },
        { name: 'gray', value: '#F7FAFC' },
        { name: 'dark', value: '#0F172A' },
      ],
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
  decorators: [
    (Story) => React.createElement(
      I18nextProvider,
      { i18n },
      React.createElement(Story)
    ),
  ],
  globalTypes: {
    locale: {
      description: '国际化语言',
      defaultValue: 'zh',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'zh', title: '中文' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
