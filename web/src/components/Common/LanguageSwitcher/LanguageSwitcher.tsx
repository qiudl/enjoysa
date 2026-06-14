import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';
import styles from './LanguageSwitcher.module.css';

export interface LanguageSwitcherProps {
  /** 变体样式 */
  variant?: 'dropdown' | 'buttons' | 'minimal';
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 是否显示语言名称 */
  showLabel?: boolean;
  /** 语言变更回调 */
  onLanguageChange?: (language: string) => void;
  /**
   * REQ-20260508-0002: render nothing inside supplier backend. Suppliers are
   * forced to en-US so the switcher would just confuse them.
   */
  hidden?: boolean;
}

const languages = [
  { code: 'zh-TW', name: '繁體中文', nativeName: '繁體中文' },
  { code: 'en', name: 'English', nativeName: 'English' },
];

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'dropdown',
  size = 'md',
  showIcon = true,
  showLabel = true,
  onLanguageChange,
  hidden = false,
}) => {
  const { i18n } = useTranslation();
  if (hidden) return null;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = languages.find(
    (lang) => lang.code === i18n.language
  ) || languages.find(
    (lang) => i18n.language?.startsWith(lang.code)
  ) || languages[0];

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    onLanguageChange?.(langCode);
    setIsOpen(false);
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'buttons') {
    return (
      <div className={clsx(styles.buttons, styles[size])}>
        {languages.map((lang) => (
          <button
            key={lang.code}
            className={clsx(
              styles.langButton,
              currentLang.code === lang.code && styles.active
            )}
            onClick={() => handleLanguageChange(lang.code)}
          >
            {lang.nativeName}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <button
        className={clsx(styles.minimal, styles[size])}
        onClick={() => {
          const currentIndex = languages.findIndex((l) => l.code === currentLang.code);
          const nextLang = languages[(currentIndex + 1) % languages.length];
          handleLanguageChange(nextLang.code);
        }}
      >
        {showIcon && <Globe size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
        {showLabel && <span>{currentLang.nativeName}</span>}
      </button>
    );
  }

  // dropdown variant
  return (
    <div className={clsx(styles.dropdown, styles[size])} ref={dropdownRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {showIcon && <Globe size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
        {showLabel && <span className={styles.label}>{currentLang.nativeName}</span>}
        <ChevronDown
          size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14}
          className={clsx(styles.chevron, isOpen && styles.open)}
        />
      </button>

      {isOpen && (
        <ul className={styles.menu} role="listbox">
          {languages.map((lang) => (
            <li key={lang.code}>
              <button
                className={clsx(
                  styles.menuItem,
                  currentLang.code === lang.code && styles.selected
                )}
                onClick={() => handleLanguageChange(lang.code)}
                role="option"
                aria-selected={currentLang.code === lang.code}
              >
                <span>{lang.nativeName}</span>
                {currentLang.code === lang.code && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LanguageSwitcher;
