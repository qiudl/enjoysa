import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Unlink, Check, X, Pencil } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import {
  Header,
  Footer,
  Button,
} from '../../components/Common';
import { ConfirmModal } from '../../components/Common';
import { userAuth } from '../../services/authService';
import styles from './UserProfileEditPage.module.css';

export interface UserProfileEditPageProps {
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userAvatar?: string;
  userLanguage?: string;
  googleBound?: boolean;
  cartCount?: number;
  onSave?: (updates: { name?: string; phone?: string; language?: string }) => Promise<boolean>;
  onGoogleBoundChange?: (bound: boolean) => void;
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

function toI18nLang(lang: string): string {
  if (lang === 'zh-CN') return 'zh';
  if (lang === 'en-US') return 'en';
  return lang;
}

export const UserProfileEditPage: React.FC<UserProfileEditPageProps> = ({
  userName = '',
  userEmail = '',
  userPhone = '',
  userAvatar,
  userLanguage = 'zh-CN',
  googleBound = false,
  cartCount = 0,
  onSave,
  onGoogleBoundChange,
  onBack,
  onLogout,
  onLoginClick,
  onRegisterClick,
  onNavClick,
}) => {
  const { t, i18n } = useTranslation();

  // Inline edit states
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(userName);
  const [phone, setPhone] = useState(userPhone);
  const [language, setLanguage] = useState(userLanguage);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Google bind state
  const [isGoogleBound, setIsGoogleBound] = useState(googleBound);
  const [googleBinding, setGoogleBinding] = useState(false);
  const [unbindConfirmOpen, setUnbindConfirmOpen] = useState(false);

  useEffect(() => {
    setNameValue(userName);
    setPhone(userPhone);
    setLanguage(userLanguage);
  }, [userName, userPhone, userLanguage]);

  useEffect(() => {
    setIsGoogleBound(googleBound);
  }, [googleBound]);

  const hasChanges = phone !== userPhone || language !== userLanguage;

  // Inline name save
  const handleNameSave = async () => {
    if (!nameValue.trim()) return;
    if (nameValue.trim() === userName) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const success = await onSave?.({ name: nameValue.trim() });
      if (success) {
        setEditingName(false);
        setMessage({ type: 'success', text: t('user.editProfile_page.success') });
      }
    } catch {
      setMessage({ type: 'error', text: t('user.editProfile_page.failed') });
    } finally {
      setSaving(false);
    }
  };

  const handleNameCancel = () => {
    setNameValue(userName);
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameSave();
    if (e.key === 'Escape') handleNameCancel();
  };

  // Form submit (phone + language)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const success = await onSave?.({ phone: phone.trim(), language });
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

  // Google bind/unbind
  const handleGoogleBind = async (response: CredentialResponse) => {
    if (!response.credential) return;
    setGoogleBinding(true);
    setMessage(null);
    try {
      await userAuth.bindGoogle(response.credential);
      setIsGoogleBound(true);
      onGoogleBoundChange?.(true);
      setMessage({ type: 'success', text: t('user.editProfile_page.googleBindSuccess', 'Google account bound successfully') });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('user.editProfile_page.googleBindFailed', 'Failed to bind Google account') });
    } finally {
      setGoogleBinding(false);
    }
  };

  const handleGoogleUnbind = async () => {
    setUnbindConfirmOpen(false);
    setGoogleBinding(true);
    setMessage(null);
    try {
      await userAuth.unbindGoogle();
      setIsGoogleBound(false);
      onGoogleBoundChange?.(false);
      setMessage({ type: 'success', text: t('user.editProfile_page.googleUnbindSuccess', 'Google account unbound successfully') });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('user.editProfile_page.googleUnbindFailed', 'Failed to unbind Google account') });
    } finally {
      setGoogleBinding(false);
    }
  };

  const displayName = userName || nameValue || '?';

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

          <div className={styles.form}>
            {/* Profile Header: Avatar + Name + Google */}
            <div className={styles.profileHeader}>
              <div className={styles.avatarPlaceholder}>
                {displayName.charAt(0).toUpperCase()}
              </div>

              <div className={styles.profileInfo}>
                {/* Inline Name */}
                <div className={styles.nameRow}>
                  {editingName ? (
                    <div className={styles.nameEdit}>
                      <input
                        type="text"
                        className={styles.nameInput}
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onKeyDown={handleNameKeyDown}
                        maxLength={50}
                        autoFocus
                      />
                      <button className={styles.nameActionBtn} onClick={handleNameSave} disabled={saving}>
                        <Check size={16} />
                      </button>
                      <button className={styles.nameActionBtn} onClick={handleNameCancel}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className={styles.nameDisplay}>
                      <span className={styles.nameText}>{displayName}</span>
                      <button className={styles.nameEditBtn} onClick={() => setEditingName(true)}>
                        <Pencil size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Email (readonly) */}
                <p className={styles.emailText}>{userEmail}</p>

                {/* Google Binding - right next to name area */}
                <div className={styles.googleRow}>
                  {isGoogleBound ? (
                    <div className={styles.googleBound}>
                      <svg viewBox="0 0 24 24" width="14" height="14" className={styles.googleSvg}>
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span className={styles.googleBoundText}>{t('user.editProfile_page.googleBound', 'Bound')}</span>
                      <button
                        className={styles.googleUnbindLink}
                        onClick={() => setUnbindConfirmOpen(true)}
                        disabled={googleBinding}
                      >
                        <Unlink size={12} />
                        {t('user.editProfile_page.unbindGoogle', 'Unbind')}
                      </button>
                    </div>
                  ) : (
                    <div className={styles.googleUnbound}>
                      <svg viewBox="0 0 24 24" width="14" height="14" className={styles.googleSvg} style={{ opacity: 0.4 }}>
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span className={styles.googleUnboundText}>{t('user.editProfile_page.googleUnbound', 'Not bound')}</span>
                      <div className={googleBinding ? styles.googleLoginDisabled : styles.googleLoginInline}>
                        <GoogleLogin
                          onSuccess={handleGoogleBind}
                          onError={() => setMessage({ type: 'error', text: t('user.editProfile_page.googleBindFailed') })}
                          size="small"
                          text="signin"
                          shape="pill"
                          type="icon"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div className={`${styles.message} ${styles[message.type]}`}>
                {message.text}
              </div>
            )}

            {/* Other fields as form */}
            <form onSubmit={handleSubmit}>
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

              {/* Submit */}
              <div className={styles.submitArea}>
                <Button
                  type="submit"
                  fullWidth
                  disabled={saving || !hasChanges}
                >
                  {saving ? t('user.editProfile_page.saving') : t('user.editProfile_page.save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>

      <Footer />

      {/* Unbind Confirm */}
      <ConfirmModal
        open={unbindConfirmOpen}
        type="danger"
        title={t('user.editProfile_page.unbindGoogleTitle', '解绑 Google 账户')}
        titleEn="Unbind Google Account"
        message={t('user.editProfile_page.unbindGoogleConfirm', '解绑后将无法使用 Google 快速登录，需要使用邮箱密码登录。确定解绑吗？')}
        messageEn="After unbinding, you won't be able to sign in with Google. You'll need to use email and password instead. Are you sure?"
        onConfirm={handleGoogleUnbind}
        onCancel={() => setUnbindConfirmOpen(false)}
      />
    </div>
  );
};

export default UserProfileEditPage;
