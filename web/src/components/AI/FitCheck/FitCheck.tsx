import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { productFit, type FitProfile, type ProductFitResponse } from '../../../services/aiService';
import styles from './FitCheck.module.css';

interface FitCheckProps {
  productId: number;
  language?: string;
}

const STORAGE_KEY = 'enjoysa_fit_profile';

function loadProfile(): FitProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { adults: 2, children: [] };
}

function saveProfile(profile: FitProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export default function FitCheck({ productId, language = 'zh' }: FitCheckProps) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<FitProfile>(loadProfile);
  const [result, setResult] = useState<ProductFitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editAdults, setEditAdults] = useState(profile.adults);
  const [editChildren, setEditChildren] = useState(profile.children.join(', '));

  useEffect(() => {
    // Auto-fetch on mount if profile exists
    if (profile.adults > 0) {
      fetchFit(profile);
    }
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFit = async (p: FitProfile) => {
    setLoading(true);
    const res = await productFit(productId, p, language);
    setResult(res);
    setLoading(false);
  };

  const handleSaveProfile = () => {
    const children = editChildren
      .split(/[,，\s]+/)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
    const newProfile = { adults: editAdults, children };
    setProfile(newProfile);
    saveProfile(newProfile);
    setEditing(false);
    fetchFit(newProfile);
  };

  const profileText = profile.children.length > 0
    ? `👨‍👩‍👧‍👦 ${profile.adults} ${t('aiFit.adults', '大人')} + ${profile.children.map((a) => `${a}${t('aiFit.yearsOld', '岁')}`).join('、')}`
    : `👤 ${profile.adults} ${t('aiFit.adults', '大人')}`;

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>🎯 {t('aiFit.title', '适合我吗？')}</div>

      {editing ? (
        <div className={styles.editor}>
          <div className={styles.editorRow}>
            <span className={styles.editorLabel}>{t('aiFit.adults', '大人')}</span>
            <input
              className={styles.editorInput}
              type="number"
              min={1}
              max={20}
              value={editAdults}
              onChange={(e) => setEditAdults(Number(e.target.value))}
            />
          </div>
          <div className={styles.editorRow}>
            <span className={styles.editorLabel}>{t('aiFit.childrenAges', '小孩年龄')}</span>
            <input
              className={styles.editorInput}
              style={{ width: 160 }}
              value={editChildren}
              onChange={(e) => setEditChildren(e.target.value)}
              placeholder="6, 3"
            />
          </div>
          <div className={styles.editorActions}>
            <button className={`${styles.editorBtn} ${styles.editorBtnPrimary}`} onClick={handleSaveProfile}>
              {t('aiFit.analyze', '分析')}
            </button>
            <button className={styles.editorBtn} onClick={() => setEditing(false)}>
              {t('common.cancel', '取消')}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.profileBar}>
          {profileText}
          <button className={styles.editBtn} onClick={() => { setEditing(true); setEditAdults(profile.adults); setEditChildren(profile.children.join(', ')); }}>
            ✏️ {t('aiFit.edit', '修改')}
          </button>
        </div>
      )}

      {loading && (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          {t('aiFit.analyzing', 'AI 分析中...')}
        </div>
      )}

      {!loading && result && result.fit_items.map((item, i) => (
        <div key={i} className={styles.fitItem}>
          <span className={styles.fitIcon}>{item.icon}</span>
          <div className={styles.fitText} dangerouslySetInnerHTML={{ __html: item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
        </div>
      ))}

      {!loading && result?.recommendation && (
        <button className={styles.cta}>{result.recommendation} →</button>
      )}
    </div>
  );
}
