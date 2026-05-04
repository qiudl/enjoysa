import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseFilters, type ParsedFilters } from '../../../services/aiService';
import styles from './AiFilterBar.module.css';

interface AiFilterBarProps {
  language?: string;
  onFiltersApplied: (filters: ParsedFilters, display: string) => void;
  onClear: () => void;
}

export default function AiFilterBar({ language = 'zh', onFiltersApplied, onClear }: AiFilterBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [display, setDisplay] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    const result = await parseFilters(query, language);
    setLoading(false);
    if (result) {
      setDisplay(result.display);
      onFiltersApplied(result.filters, result.display);
    }
  };

  const handleClear = () => {
    setQuery('');
    setDisplay('');
    onClear();
  };

  return (
    <div className={styles.wrapper}>
      <form onSubmit={handleSubmit} className={styles.inputRow}>
        <span className={styles.icon}>🧠</span>
        <input
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('aiFilter.placeholder', '告诉我你想要什么，如"浪漫双人体验，预算500以内"')}
          maxLength={500}
        />
        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? <><span className={styles.loading} />{t('aiFilter.parsing', '解析中')}</> : t('aiFilter.search', '搜索')}
        </button>
      </form>
      {display && (
        <div className={styles.resultBar}>
          <span className={styles.label}>AI 已筛选：</span>
          <span>{display}</span>
          <button className={styles.clearBtn} onClick={handleClear}>✕ {t('aiFilter.clear', '清除')}</button>
        </div>
      )}
    </div>
  );
}
