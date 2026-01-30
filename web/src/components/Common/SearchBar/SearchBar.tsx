import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import styles from './SearchBar.module.css';

export interface SearchBarProps {
  /** 搜索值 */
  value?: string;
  /** 占位符 */
  placeholder?: string;
  /** 最近搜索 */
  recentSearches?: string[];
  /** 热门搜索 */
  hotSearches?: string[];
  /** 值变化回调 */
  onChange?: (value: string) => void;
  /** 提交搜索 */
  onSearch?: (value: string) => void;
  /** 清除最近搜索 */
  onClearRecentSearches?: () => void;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否自动聚焦 */
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value: controlledValue,
  placeholder,
  recentSearches = [],
  hotSearches = [],
  onChange,
  onSearch,
  onClearRecentSearches,
  size = 'md',
  autoFocus = false,
}) => {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState(controlledValue || '');
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const value = controlledValue !== undefined ? controlledValue : localValue;

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange?.(newValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSearch?.(value.trim());
      setShowDropdown(false);
    }
  };

  const handleClear = () => {
    setLocalValue('');
    onChange?.('');
    inputRef.current?.focus();
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setLocalValue(suggestion);
    onChange?.(suggestion);
    onSearch?.(suggestion);
    setShowDropdown(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setShowDropdown(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const hasDropdownContent =
    !value && (recentSearches.length > 0 || hotSearches.length > 0);

  return (
    <div ref={containerRef} className={clsx(styles.container, styles[size])}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div
          className={clsx(styles.inputWrapper, {
            [styles.focused]: isFocused,
          })}
        >
          <Search size={size === 'lg' ? 22 : size === 'sm' ? 16 : 18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={placeholder || t('search.placeholder')}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          {value && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
            >
              <X size={16} />
            </button>
          )}
          <button type="submit" className={styles.searchButton}>
            {t('common.search')}
          </button>
        </div>
      </form>

      {/* 下拉建议 */}
      {showDropdown && hasDropdownContent && (
        <div className={styles.dropdown}>
          {/* 最近搜索 */}
          {recentSearches.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Clock size={14} />
                <span>{t('search.recentSearches')}</span>
                <button
                  className={styles.clearAll}
                  onClick={onClearRecentSearches}
                >
                  清除
                </button>
              </div>
              <div className={styles.suggestions}>
                {recentSearches.map((item, index) => (
                  <button
                    key={index}
                    className={styles.suggestionItem}
                    onClick={() => handleSelectSuggestion(item)}
                  >
                    <Clock size={14} className={styles.suggestionIcon} />
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 热门搜索 */}
          {hotSearches.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <TrendingUp size={14} />
                <span>{t('search.hotSearches')}</span>
              </div>
              <div className={styles.hotTags}>
                {hotSearches.map((item, index) => (
                  <button
                    key={index}
                    className={clsx(styles.hotTag, {
                      [styles.hotTagTop]: index < 3,
                    })}
                    onClick={() => handleSelectSuggestion(item)}
                  >
                    <span className={styles.hotRank}>{index + 1}</span>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
