import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/Common';
import { LoginForm, RegisterForm } from '../../components/Auth';
import styles from './LoginPage.module.css';

export interface LoginPageProps {
  /** 当前语言 */
  language?: 'zh' | 'en';
  /** 初始模式 */
  initialMode?: 'login' | 'register';
  /** 登录函数 */
  onLogin?: (email: string, password: string) => Promise<boolean>;
  /** Google 登录函数 */
  onGoogleLogin?: (idToken: string) => Promise<boolean>;
  /** 注册函数 */
  onRegister?: (email: string, password: string, name: string) => Promise<boolean>;
  /** 登录成功回调 */
  onLoginSuccess?: (user?: { identifier: string; type: 'email' | 'phone' }) => void;
  /** 注册成功回调 */
  onRegisterSuccess?: (user?: { identifier: string; type: 'email' | 'phone'; nickname: string }) => void;
  /** 语言切换 */
  onLanguageChange?: (lang: 'zh' | 'en') => void;
  /** 返回首页回调 */
  onNavigateHome?: () => void;
  /** 忘记密码回调 */
  onForgotPassword?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  initialMode = 'login',
  onLogin,
  onGoogleLogin,
  onRegister,
  onLoginSuccess,
  onRegisterSuccess,
  onLanguageChange,
  onNavigateHome,
  onForgotPassword,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  const handleLanguageChange = (lang: string) => {
    const typedLang = lang as 'zh' | 'en';
    onLanguageChange?.(typedLang);
  };

  return (
    <div className={styles.page}>
      {/* Language Switcher */}
      <div className={styles.langSwitcher}>
        <LanguageSwitcher
          variant="dropdown"
          size="sm"
          onLanguageChange={handleLanguageChange}
        />
      </div>

      <div className={styles.container}>
        {/* Left Side - Branding */}
        <div className={styles.brandingSide}>
          <div className={styles.brandingContent}>
            <h1 className={styles.logo}>{t('brand.name')}</h1>
            <p className={styles.tagline}>{t('brand.tagline')}</p>
            <ul className={styles.features}>
              <li>{t('auth.feature1')}</li>
              <li>{t('auth.feature2')}</li>
              <li>{t('auth.feature3')}</li>
              <li>{t('auth.feature4')}</li>
            </ul>
          </div>
          <div className={styles.brandingOverlay} />
        </div>

        {/* Right Side - Form */}
        <div className={styles.formSide}>
          <div className={styles.formContainer}>
            {/* Clickable Logo */}
            <div className={styles.formLogo} onClick={onNavigateHome}>
              <span className={styles.formLogoText}>EnjoySA</span>
              <span className={styles.formLogoSubtext}>{t('brand.subtitle', '畅游南澳')}</span>
            </div>

            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>
                {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
              </h2>
              <p className={styles.formSubtitle}>
                {mode === 'login' ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
              </p>
            </div>

            {mode === 'login' ? (
              <LoginForm
                onLogin={onLogin}
                onGoogleLogin={onGoogleLogin}
                onSuccess={(data) => onLoginSuccess?.(data)}
                onSwitchToRegister={() => setMode('register')}
                onForgotPassword={onForgotPassword}
              />
            ) : (
              <RegisterForm
                onRegister={onRegister}
                onSuccess={(data) => onRegisterSuccess?.(data)}
                onSwitchToLogin={() => setMode('login')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
