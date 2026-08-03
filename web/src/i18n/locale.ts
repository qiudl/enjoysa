export type LocaleScope = 'public' | 'admin' | 'supplier';
export type AppLocale = 'zh-TW' | 'zh-CN' | 'en-US';

export const LOCALE_STORAGE_KEYS: Record<LocaleScope, string> = {
  public: 'enjoysa.locale.public',
  admin: 'enjoysa.locale.admin',
  supplier: 'enjoysa.locale.supplier',
};

export const DEFAULT_LOCALES: Record<LocaleScope, AppLocale> = {
  public: 'zh-TW',
  admin: 'zh-TW',
  supplier: 'en-US',
};

export const LEGACY_LOCALE_STORAGE_KEY = 'i18n-lang';

export function getLocaleScope(pathname: string): LocaleScope {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/supplier' || pathname.startsWith('/supplier/')) return 'supplier';
  return 'public';
}

export function normalizeAppLocale(locale?: string | null): AppLocale | null {
  if (!locale) return null;
  if (locale === 'zh-TW' || locale.toLowerCase() === 'zh-hk') return 'zh-TW';
  if (locale === 'zh-CN' || locale === 'zh' || locale.toLowerCase() === 'zh-cn') return 'zh-CN';
  if (locale === 'en-US' || locale === 'en' || locale.toLowerCase().startsWith('en-')) return 'en-US';
  return null;
}

export function toI18nLanguage(locale: AppLocale): string {
  if (locale === 'zh-TW') return 'zh';
  if (locale === 'en-US') return 'en';
  return locale;
}

export function fromI18nLanguage(language?: string | null): AppLocale {
  if (language === 'zh') return 'zh-TW';
  return normalizeAppLocale(language) ?? 'zh-TW';
}

export function isChineseLanguage(language?: string | null): boolean {
  const locale = normalizeAppLocale(language);
  return locale === 'zh-TW' || locale === 'zh-CN';
}

export function isEnglishLanguage(language?: string | null): boolean {
  return normalizeAppLocale(language) === 'en-US';
}

export function toBackendLocale(language?: string | null): 'zh-CN' | 'en-US' {
  // Backend and AI APIs currently accept one Chinese content variant.
  // Keep zh-TW as a display locale and send zh-CN for data/API compatibility.
  return isEnglishLanguage(language) ? 'en-US' : 'zh-CN';
}

function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredLocale(scope: LocaleScope): AppLocale | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  const scopedLocale = normalizeAppLocale(storage.getItem(LOCALE_STORAGE_KEYS[scope]));
  if (scopedLocale) return scopedLocale;

  const legacyLocale = normalizeAppLocale(storage.getItem(LEGACY_LOCALE_STORAGE_KEY));
  if (!legacyLocale) return null;
  return scope === 'supplier' ? null : legacyLocale;
}

export function writeStoredLocale(scope: LocaleScope, locale: AppLocale): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  storage.setItem(LOCALE_STORAGE_KEYS[scope], locale);
}

export function resolveLocaleForPath(pathname: string): { scope: LocaleScope; locale: AppLocale } {
  const scope = getLocaleScope(pathname);
  return {
    scope,
    locale: readStoredLocale(scope) ?? DEFAULT_LOCALES[scope],
  };
}
