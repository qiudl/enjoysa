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

const savedLng = localStorage.getItem('i18n-lang') || 'zh-TW';

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

/**
 * Force the supplier backend (`/supplier/*`) into English regardless of the
 * user's stored preference. Called by SupplierLayout on mount.
 *
 * REQ-20260508-0002: the supplier backend is EN-only because most South
 * Australian suppliers cannot read Chinese; consumer-side language is decoupled
 * via the AI translation pipeline.
 */
export function setSupplierLocale(): void {
  if (i18n.language !== 'en') {
    i18n.changeLanguage('en');
  }
}

export default i18n;
