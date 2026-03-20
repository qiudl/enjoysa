import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';
import zhTW from './locales/zh-TW.json';

const resources = {
  zh: { translation: zhCN },
  en: { translation: enUS },
  'zh-TW': { translation: zhTW },
};

const savedLng = localStorage.getItem('i18n-lang') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLng,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18n-lang', lng);
});

export default i18n;
