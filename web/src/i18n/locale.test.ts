import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCALES,
  getLocaleScope,
  isChineseLanguage,
  isEnglishLanguage,
  LOCALE_STORAGE_KEYS,
  normalizeAppLocale,
  resolveLocaleForPath,
  toBackendLocale,
  toI18nLanguage,
  writeStoredLocale,
} from './locale';

describe('locale routing defaults', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
      clear: vi.fn(() => {
        values.clear();
      }),
      key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
      get length() {
        return values.size;
      },
    } satisfies Storage;

    vi.stubGlobal('localStorage', storage);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
  });

  it('uses zh-TW for public and admin routes by default', () => {
    expect(resolveLocaleForPath('/').locale).toBe(DEFAULT_LOCALES.public);
    expect(resolveLocaleForPath('/admin/login').locale).toBe(DEFAULT_LOCALES.admin);
  });

  it('uses en-US for supplier routes by default', () => {
    expect(resolveLocaleForPath('/supplier/login').locale).toBe(DEFAULT_LOCALES.supplier);
  });

  it('stores each route scope independently', () => {
    writeStoredLocale('public', 'en-US');
    writeStoredLocale('admin', 'zh-CN');
    writeStoredLocale('supplier', 'en-US');

    expect(resolveLocaleForPath('/').locale).toBe('en-US');
    expect(resolveLocaleForPath('/admin').locale).toBe('zh-CN');
    expect(resolveLocaleForPath('/supplier').locale).toBe('en-US');
  });

  it('ignores the legacy key for supplier but keeps public/admin compatibility', () => {
    window.localStorage.setItem('i18n-lang', 'en');

    expect(resolveLocaleForPath('/').locale).toBe('en-US');
    expect(resolveLocaleForPath('/admin/orders').locale).toBe('en-US');
    expect(resolveLocaleForPath('/supplier/orders').locale).toBe('en-US');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEYS.supplier)).toBeNull();
  });
});

describe('locale helpers', () => {
  it('detects route scopes', () => {
    expect(getLocaleScope('/admin/login')).toBe('admin');
    expect(getLocaleScope('/supplier/products')).toBe('supplier');
    expect(getLocaleScope('/products')).toBe('public');
  });

  it('normalizes legacy language codes', () => {
    expect(normalizeAppLocale('zh')).toBe('zh-CN');
    expect(normalizeAppLocale('en')).toBe('en-US');
    expect(normalizeAppLocale('zh-TW')).toBe('zh-TW');
  });

  it('maps app locales to legacy-safe i18n language keys', () => {
    expect(toI18nLanguage('zh-TW')).toBe('zh');
    expect(toI18nLanguage('zh-CN')).toBe('zh-CN');
    expect(toI18nLanguage('en-US')).toBe('en');
  });

  it('treats the runtime zh alias as zh-TW', async () => {
    const { fromI18nLanguage } = await import('./locale');

    expect(fromI18nLanguage('zh')).toBe('zh-TW');
  });

  it('maps display languages to backend AI locale values', () => {
    expect(toBackendLocale('zh-TW')).toBe('zh-CN');
    expect(toBackendLocale('zh-CN')).toBe('zh-CN');
    expect(toBackendLocale('en-US')).toBe('en-US');
    expect(isChineseLanguage('zh-TW')).toBe(true);
    expect(isEnglishLanguage('en')).toBe(true);
  });
});
