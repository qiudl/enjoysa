import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { smartSearch, type SmartSearchResponse } from '../../../services/aiService';
import styles from './SmartSearchDropdown.module.css';

interface SmartSearchDropdownProps {
  onProductClick: (productId: number) => void;
  language?: string;
}

export default function SmartSearchDropdown({ onProductClick, language = 'zh' }: SmartSearchDropdownProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SmartSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResult(null);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    setShowDropdown(true);
    const res = await smartSearch(q, language);
    setResult(res);
    setLoading(false);
  }, [language]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(query);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <form onSubmit={handleSubmit} className={styles.inputRow}>
        <span className={styles.aiBadge}>✨ {t('aiSearch.badge', 'AI 智能搜索')}</span>
        <input
          className={styles.input}
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={t('aiSearch.placeholder', '试试输入"带小朋友的一日游"')}
          onFocus={() => result && setShowDropdown(true)}
        />
        <button type="submit" className={styles.searchBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </button>
      </form>

      {showDropdown && (
        <div className={styles.dropdown}>
          {loading ? (
            <div className={styles.loading}>
              <span className={styles.spinner} />
              {t('aiSearch.thinking', 'AI 正在理解你的需求...')}
            </div>
          ) : result ? (
            <>
              {/* Intent bar */}
              <div className={styles.intentBar}>
                <span>🧠</span>
                <span className={styles.intentText}>{result.intent.parsed}</span>
                <div className={styles.intentTags}>
                  {result.intent.tags.map((tag) => (
                    <span key={tag} className={styles.intentTag}>{tag}</span>
                  ))}
                </div>
              </div>

              {/* Product results */}
              {result.products.map((p) => (
                <div
                  key={p.id}
                  className={styles.resultItem}
                  onClick={() => { onProductClick(p.id); setShowDropdown(false); }}
                >
                  <img
                    className={styles.resultImg}
                    src={p.image_url || '/placeholder.png'}
                    alt={p.name}
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
                  />
                  <div className={styles.resultInfo}>
                    <div className={styles.resultName}>{p.name}</div>
                    <div className={styles.resultMeta}>
                      <span className={styles.resultRating}>⭐ {p.rating.toFixed(1)}</span>
                      <span>{p.duration}</span>
                      <span>{p.region}</span>
                    </div>
                  </div>
                  <div className={styles.resultPrice}>
                    A${p.price_from}
                  </div>
                </div>
              ))}

              {result.products.length === 0 && (
                <div className={styles.loading}>
                  {t('aiSearch.noResults', '暂未找到匹配产品，试试其他描述')}
                </div>
              )}

              {/* Tip bar */}
              {result.tip && (
                <div className={styles.tipBar}>
                  💡 {result.tip}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
