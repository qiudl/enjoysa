import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Lock } from 'lucide-react';
import {
  Header,
  Footer,
  Button,
} from '../../components/Common';
import styles from './UserProfileEditPage.module.css';

export interface UserProfileEditPageProps {
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userAvatar?: string;
  userLanguage?: string;
  cartCount?: number;
  onSave?: (updates: { name?: string; phone?: string; language?: string }) => Promise<boolean>;
  onBack?: () => void;
  onLogout?: () => void;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
}

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' },
];

/** Map user profile language code to i18n language code */
function toI18nLang(lang: string): string {
  if (lang === 'zh-CN') return 'zh';
  if (lang === 'en-US') return 'en';
  return lang; // zh-TW stays zh-TW
}

export const UserProfileEditPage: React.FC<UserProfileEditPageProps> = ({
  userName = '',
  userEmail = '',
  userPhone = '',
  userAvatar,
  userLanguage = 'zh-CN',
  cartCount = 0,
  onSave,
  onBack,
  onLogout,
  onLoginClick,
  onRegisterClick,
  onNavClick,
}) => {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState(userPhone);
  const [language, setLanguage] = useState(userLanguage);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setName(userName);
    setPhone(userPhone);
    setLanguage(userLanguage);
  }, [userName, userPhone, userLanguage]);

  const hasChanges = name !== userName || phone !== userPhone || language !== userLanguage;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setMessage({ type: 'error', text: t('user.editProfile_page.nameRequired') });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const success = await onSave?.({ name: name.trim(), phone: phone.trim(), language });
      if (success) {
        i18n.changeLanguage(toI18nLang(language));
        setMessage({ type: 'success', text: t('user.editProfile_page.success') });
        setTimeout(() => onBack?.(), 1000);
      } else {
        setMessage({ type: 'error', text: t('user.editProfile_page.failed') });
      }
    } catch {
      setMessage({ type: 'error', text: t('user.editProfile_page.failed') });
    } finally {
      setSaving(false);
    }
  };

  const displayName = userName || name || '?';

  return (
    <div className={styles.page}>
      <Header
        isLoggedIn={!!userName}
        userName={userName}
        userAvatar={userAvatar}
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
        onLogout={onLogout}
      />

      <main className={styles.main}>
        <div className={styles.container}>
          <button className={styles.backButton} onClick={onBack}>
            <ArrowLeft size={18} />
            <span>{t('user.editProfile_page.back')}</span>
          </button>

          <h1 className={styles.pageTitle}>{t('user.editProfile_page.title')}</h1>

          <form className={styles.form} onSubmit={handleSubmit}>
            {/* Avatar */}
            <div className={styles.avatarSection}>
              {userAvatar ? (
                <img src={userAvatar} alt={displayName} className={styles.avatar} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <p className={styles.avatarNote}>{t('user.editProfile_page.avatarNote')}</p>
            </div>

            {/* Name */}
            <div className={styles.field}>
              <label className={styles.label}>{t('user.editProfile_page.name')}</label>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                required
              />
            </div>

            {/* Email (readonly) */}
            <div className={styles.field}>
              <label className={styles.label}>
                {t('user.editProfile_page.email')}
                <Lock size={14} className={styles.lockIcon} />
              </label>
              <input
                type="email"
                className={`${styles.input} ${styles.inputReadonly}`}
                value={userEmail}
                readOnly
              />
              <p className={styles.fieldNote}>{t('user.editProfile_page.emailReadonly')}</p>
            </div>

            {/* Phone */}
            <div className={styles.field}>
              <label className={styles.label}>{t('user.editProfile_page.phone')}</label>
              <input
                type="tel"
                className={styles.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+61 xxx xxx xxx"
              />
            </div>

            {/* Language */}
            <div className={styles.field}>
              <label className={styles.label}>{t('user.editProfile_page.language')}</label>
              <select
                className={styles.select}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Message */}
            {message && (
              <div className={`${styles.message} ${styles[message.type]}`}>
                {message.text}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              fullWidth
              disabled={saving || !hasChanges}
            >
              {saving ? t('user.editProfile_page.saving') : t('user.editProfile_page.save')}
            </Button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default UserProfileEditPage;
