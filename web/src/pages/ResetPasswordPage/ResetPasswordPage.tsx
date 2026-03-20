import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { LanguageSwitcher } from '../../components/Common';
import { Button } from '../../components/Common/Button';
import { Input } from '../../components/Common/Input';
import { userAuth } from '../../services/authService';
import styles from './ResetPasswordPage.module.css';

export interface ResetPasswordPageProps {
  token?: string;
  onNavigateHome?: () => void;
  onGoToLogin?: () => void;
  onRequestNewLink?: () => void;
}

type PageState = 'form' | 'success' | 'error';

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  token,
  onNavigateHome,
  onGoToLogin,
  onRequestNewLink,
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pageState, setPageState] = useState<PageState>(token ? 'form' : 'error');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || password.length < 8) {
      setError(t('auth.newPasswordPlaceholder'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setIsLoading(true);
    try {
      await userAuth.resetPassword(token!, password);
      setPageState('success');
    } catch {
      setPageState('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.langSwitcher}>
        <LanguageSwitcher variant="dropdown" size="sm" />
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

        {/* Right Side */}
        <div className={styles.formSide}>
          <div className={styles.formContainer}>
            <div className={styles.formLogo} onClick={onNavigateHome}>
              <span className={styles.formLogoText}>EnjoySA</span>
              <span className={styles.formLogoSubtext}>{t('brand.subtitle', '畅游南澳')}</span>
            </div>

            {pageState === 'form' && (
              <>
                <div className={styles.formHeader}>
                  <h2 className={styles.formTitle}>{t('auth.resetPasswordTitle')}</h2>
                  <p className={styles.formSubtitle}>{t('auth.resetPasswordSubtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                  {error && <div className={styles.errorBanner}>{error}</div>}

                  <div className={styles.passwordInput}>
                    <Input
                      label={t('auth.newPassword')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('auth.newPasswordPlaceholder')}
                      leftIcon={<Lock size={18} />}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      rightElement={
                        <button
                          type="button"
                          className={styles.togglePassword}
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />
                  </div>

                  <div className={styles.passwordInput}>
                    <Input
                      label={t('auth.confirmNewPassword')}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder={t('auth.confirmPasswordPlaceholder')}
                      leftIcon={<Lock size={18} />}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      rightElement={
                        <button
                          type="button"
                          className={styles.togglePassword}
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={isLoading}
                  >
                    {isLoading ? t('auth.resettingPassword') : t('auth.resetPassword')}
                  </Button>
                </form>
              </>
            )}

            {pageState === 'success' && (
              <div className={styles.resultContainer}>
                <div className={`${styles.resultIcon} ${styles.success}`}>
                  <CheckCircle size={32} />
                </div>
                <h2 className={styles.resultTitle}>{t('auth.resetSuccess')}</h2>
                <p className={styles.resultDesc}>{t('auth.resetSuccessDesc')}</p>
                <Button variant="primary" size="lg" fullWidth onClick={onGoToLogin}>
                  {t('auth.goToLogin')}
                </Button>
              </div>
            )}

            {pageState === 'error' && (
              <div className={styles.resultContainer}>
                <div className={`${styles.resultIcon} ${styles.error}`}>
                  <XCircle size={32} />
                </div>
                <h2 className={styles.resultTitle}>{t('auth.invalidToken')}</h2>
                <p className={styles.resultDesc}>{t('auth.invalidTokenDesc')}</p>
                <Button variant="primary" size="lg" fullWidth onClick={onRequestNewLink}>
                  {t('auth.requestNewLink')}
                </Button>
                <button className={styles.linkButton} onClick={onGoToLogin}>
                  <ArrowLeft size={16} />
                  {t('auth.backToLogin')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
