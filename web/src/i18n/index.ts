import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';
import zhTW from './locales/zh-TW.json';
import {
  DEFAULT_LOCALES,
  fromI18nLanguage,
  getLocaleScope,
  resolveLocaleForPath,
  toI18nLanguage,
  type AppLocale,
  type LocaleScope,
  writeStoredLocale,
} from './locale';

const resources = {
  zh: { translation: zhTW },
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
  en: { translation: enUS },
  'en-US': { translation: enUS },
};

let activeScope: LocaleScope = getLocaleScope(
  typeof window === 'undefined' ? '/' : window.location.pathname
);
const initialLocale = resolveLocaleForPath(
  typeof window === 'undefined' ? '/' : window.location.pathname
).locale;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: toI18nLanguage(initialLocale),
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  writeStoredLocale(activeScope, fromI18nLanguage(lng));
});

export function setLocaleForScope(scope: LocaleScope, locale: AppLocale): void {
  activeScope = scope;
  writeStoredLocale(scope, locale);
  i18n.changeLanguage(toI18nLanguage(locale));
}

export function setLocaleForCurrentRoute(locale: AppLocale): void {
  const scope = getLocaleScope(typeof window === 'undefined' ? '/' : window.location.pathname);
  setLocaleForScope(scope, locale);
}

export function syncLocaleWithPath(pathname: string): void {
  const { scope, locale } = resolveLocaleForPath(pathname);
  activeScope = scope;
  const nextLanguage = toI18nLanguage(locale);
  if (i18n.language !== nextLanguage) {
    i18n.changeLanguage(nextLanguage);
  }
}

/**
 * Force the supplier backend (`/supplier/*`) into English regardless of the
 * user's stored preference. Called by SupplierLayout on mount.
 *
 * REQ-20260508-0002: the supplier backend is EN-only because most South
 * Australian suppliers cannot read Chinese; consumer-side language is decoupled
 * via the AI translation pipeline.
 */
export function setSupplierLocale(): void {
  setLocaleForScope('supplier', DEFAULT_LOCALES.supplier);
}

export default i18n;
