import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { LanguageSwitcher } from '../../../components/Common';
import styles from './AdminLoginPage.module.css';

export interface AdminLoginPageProps {
  onLoginSuccess?: () => void;
  onLogin?: (email: string, password: string) => Promise<boolean>;
  onLanguageChange?: (lang: 'zh' | 'en') => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onLogin,
  onLanguageChange,
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('admin@enjoysa.com.au');
  const [password, setPassword] = useState('Admin123!');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLanguageChange = (lang: string) => {
    onLanguageChange?.(lang as 'zh' | 'en');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('admin.login.errorRequired', 'Please enter email and password'));
      return;
    }

    setIsLoading(true);

    try {
      if (onLogin) {
        const success = await onLogin(email, password);
        if (success) {
          onLoginSuccess?.();
        } else {
          setError(t('admin.login.errorInvalid', 'Invalid email or password'));
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        onLoginSuccess?.();
      }
    } catch {
      setError(t('admin.login.errorNetwork', 'Network error, please try again'));
    } finally {
      setIsLoading(false);
    }
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
            <div className={styles.brandIcon}>
              <Shield size={56} />
            </div>
            <h1 className={styles.brandTitle}>EnjoySA</h1>
            <p className={styles.brandSubtitle}>{t('admin.login.platformName', 'Platform Admin')}</p>
            <p className={styles.brandDesc}>
              {t('admin.login.description', 'Comprehensive management dashboard for EnjoySA platform')}
            </p>
            <div className={styles.features}>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>👥</span>
                <span>{t('admin.login.feature1', 'User Management')}</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>🏢</span>
                <span>{t('admin.login.feature2', 'Supplier Management')}</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>📦</span>
                <span>{t('admin.login.feature3', 'Product Review')}</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>📊</span>
                <span>{t('admin.login.feature4', 'Data Analytics')}</span>
              </div>
            </div>
          </div>
          <div className={styles.brandingOverlay} />
        </div>

        {/* Right Side - Login Form */}
        <div className={styles.formSide}>
          <div className={styles.formContainer}>
            {/* Logo */}
            <div className={styles.formLogo}>
              <div className={styles.logoIcon}>
                <Shield size={32} />
              </div>
              <span className={styles.logoText}>{t('admin.login.title', 'Admin Login')}</span>
            </div>

            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>
                {t('admin.login.welcomeBack', 'Welcome Back')}
              </h2>
              <p className={styles.formSubtitle}>
                {t('admin.login.subtitle', 'Sign in to access the admin dashboard')}
              </p>
            </div>

            {/* Login Form */}
            <form className={styles.form} onSubmit={handleSubmit}>
              {error && <div className={styles.error}>{error}</div>}

              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  {t('admin.login.email', 'Email')}
                </label>
                <div className={styles.inputWrapper}>
                  <Mail size={18} className={styles.inputIcon} />
                  <input
                    type="email"
                    className={styles.input}
                    placeholder={t('admin.login.emailPlaceholder', 'Enter your email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  {t('admin.login.password', 'Password')}
                </label>
                <div className={styles.inputWrapper}>
                  <Lock size={18} className={styles.inputIcon} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.input}
                    placeholder={t('admin.login.passwordPlaceholder', 'Enter your password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={isLoading}
              >
                {isLoading
                  ? t('admin.login.loggingIn', 'Signing in...')
                  : t('admin.login.loginButton', 'Sign In')}
              </button>
            </form>

            {/* Footer */}
            <div className={styles.footer}>
              <p className={styles.footerText}>
                {t('admin.login.securityNote', 'This is a secure admin area. Unauthorized access is prohibited.')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
