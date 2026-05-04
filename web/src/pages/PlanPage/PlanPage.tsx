import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Header, Footer } from '../../components/Common';
import { planItineraryStream } from '../../services/aiService';
import styles from './PlanPage.module.css';

const PREF_OPTIONS = [
  { key: 'family', emoji: '👨‍👩‍👧‍👦', zh: '亲子', en: 'Family' },
  { key: 'food', emoji: '🍽️', zh: '美食', en: 'Food' },
  { key: 'nature', emoji: '🌿', zh: '自然', en: 'Nature' },
  { key: 'adventure', emoji: '🧗', zh: '冒险', en: 'Adventure' },
  { key: 'culture', emoji: '🏛️', zh: '文化', en: 'Culture' },
  { key: 'wine', emoji: '🍷', zh: '品酒', en: 'Wine' },
  { key: 'photo', emoji: '📸', zh: '摄影', en: 'Photography' },
  { key: 'beach', emoji: '🏖️', zh: '海滩', en: 'Beach' },
];

interface PlanPageProps {
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
}

export default function PlanPage({ onLoginClick, onRegisterClick, onNavClick }: PlanPageProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');
  const lang = isZh ? 'zh' : 'en';

  const [adults, setAdults] = useState(2);
  const [childrenStr, setChildrenStr] = useState('');
  const [days, setDays] = useState(3);
  const [budget, setBudget] = useState(2000);
  const [prefs, setPrefs] = useState<string[]>(['family', 'food']);

  const [streaming, setStreaming] = useState(false);
  const [content, setContent] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const togglePref = (key: string) => {
    setPrefs((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  const handleGenerate = useCallback(() => {
    const children = childrenStr
      .split(/[,，\s]+/)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);

    const prefLabels = prefs.map((k) => {
      const opt = PREF_OPTIONS.find((o) => o.key === k);
      return opt ? (isZh ? opt.zh : opt.en) : k;
    });

    setContent('');
    setElapsedMs(0);
    setStreaming(true);

    abortRef.current = planItineraryStream(
      {
        travelers: { adults, children },
        days,
        preferences: prefLabels,
        budget,
        language: lang,
      },
      (text) => setContent((prev) => prev + text),
      (ms) => { setElapsedMs(ms); setStreaming(false); },
      () => setStreaming(false),
    );
  }, [adults, childrenStr, days, budget, prefs, lang, isZh]);

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  return (
    <div className={styles.page}>
      <Header onLoginClick={onLoginClick} onRegisterClick={onRegisterClick} onNavClick={onNavClick} />

      <div className={styles.hero}>
        <h1>🗓️ {t('plan.title', 'AI 行程规划')}</h1>
        <p>{t('plan.subtitle', '告诉我们你的偏好，AI 为你量身定制南澳行程')}</p>
      </div>

      <div className={styles.container}>
        {/* Input form */}
        <div className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>{t('plan.adults', '大人')}</label>
              <input type="number" min={1} max={20} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
            </div>
            <div className={styles.formGroup}>
              <label>{t('plan.childrenAges', '小孩年龄（逗号分隔）')}</label>
              <input value={childrenStr} onChange={(e) => setChildrenStr(e.target.value)} placeholder="6, 3" />
            </div>
            <div className={styles.formGroup}>
              <label>{t('plan.days', '天数')}</label>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} {t('plan.day', '天')}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>{t('plan.budget', '总预算 (A$)')}</label>
              <input type="number" min={0} step={100} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>{t('plan.preferences', '偏好（可多选）')}</label>
            <div className={styles.prefTags}>
              {PREF_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={`${styles.prefTag} ${prefs.includes(opt.key) ? styles.prefTagActive : ''}`}
                  onClick={() => togglePref(opt.key)}
                >
                  {opt.emoji} {isZh ? opt.zh : opt.en}
                </button>
              ))}
            </div>
          </div>

          <button className={styles.genBtn} onClick={handleGenerate} disabled={streaming}>
            ✨ {streaming ? t('plan.generating', '正在规划...') : t('plan.generate', '为我规划行程')}
          </button>
        </div>

        {/* Result */}
        {(content || streaming) && (
          <div className={styles.result}>
            <div className={styles.resultHeader}>
              <h2>🤖 {t('plan.yourItinerary', '你的专属行程')}</h2>
              {!streaming && content && (
                <div className={styles.resultActions}>
                  <button onClick={handleGenerate}>🔄 {t('plan.regenerate', '重新生成')}</button>
                </div>
              )}
            </div>

            {streaming && !content && (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                {t('plan.thinking', 'AI 正在规划你的行程...')}
              </div>
            )}

            <div className={styles.streamContent}>
              {content}
              {streaming && <span className={styles.cursor} />}
            </div>

            {streaming && (
              <button className={styles.stopBtn} onClick={handleStop}>
                <span className={styles.stopIcon} />
                {t('plan.stop', '停止生成')}
              </button>
            )}

            {!streaming && elapsedMs > 0 && (
              <div className={styles.elapsed}>
                ⏱ {(elapsedMs / 1000).toFixed(1)}s
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
