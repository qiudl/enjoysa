import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { LanguageSwitcher } from '../../components/Common';
import { Button } from '../../components/Common/Button';
import { Input } from '../../components/Common/Input';
import { userAuth } from '../../services/authService';
import styles from './ForgotPasswordPage.module.css';

export interface ForgotPasswordPageProps {
  onNavigateHome?: () => void;
  onBackToLogin?: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onNavigateHome,
  onBackToLogin,
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t('auth.emailRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('auth.emailInvalid'));
      return;
    }

    setIsLoading(true);
    try {
      await userAuth.forgotPassword(email);
      setIsSent(true);
    } catch {
      // Still show success to prevent email enumeration
      setIsSent(true);
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

        {/* Right Side - Form */}
        <div className={styles.formSide}>
          <div className={styles.formContainer}>
            <div className={styles.formLogo} onClick={onNavigateHome}>
              <span className={styles.formLogoText}>EnjoySA</span>
              <span className={styles.formLogoSubtext}>{t('brand.subtitle', '畅游南澳')}</span>
            </div>

            {!isSent ? (
              <>
                <div className={styles.formHeader}>
                  <h2 className={styles.formTitle}>{t('auth.forgotPasswordTitle')}</h2>
                  <p className={styles.formSubtitle}>{t('auth.forgotPasswordSubtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                  {error && <div className={styles.errorBanner}>{error}</div>}

                  <Input
                    label={t('auth.email')}
                    type="email"
                    placeholder="example@email.com"
                    leftIcon={<Mail size={18} />}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={isLoading}
                  >
                    {isLoading ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
                  </Button>
                </form>
              </>
            ) : (
              <div className={styles.sentContainer}>
                <div className={styles.sentIcon}>
                  <CheckCircle size={32} />
                </div>
                <h2 className={styles.sentTitle}>{t('auth.resetLinkSent')}</h2>
                <p className={styles.sentDesc}>{t('auth.resetLinkSentDesc')}</p>
              </div>
            )}

            <button className={styles.backLink} onClick={onBackToLogin}>
              <ArrowLeft size={16} />
              {t('auth.backToLogin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
