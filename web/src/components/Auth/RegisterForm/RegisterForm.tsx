import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Mail, Phone, User, ArrowRight, Check } from 'lucide-react';
import { Button } from '../../Common/Button';
import { Input } from '../../Common/Input';
import styles from './RegisterForm.module.css';

export interface RegisterFormProps {
  /** 注册成功回调 */
  onSuccess?: (data: {
    identifier: string;
    type: 'email' | 'phone';
    nickname: string;
  }) => void;
  /** 切换到登录 */
  onSwitchToLogin?: () => void;
  /** 查看服务条款 */
  onViewTerms?: () => void;
  /** 查看隐私政策 */
  onViewPrivacy?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onSwitchToLogin,
  onViewTerms,
  onViewPrivacy,
}) => {
  const { t } = useTranslation();
  const [registerType, setRegisterType] = useState<'phone' | 'email'>('phone');
  const [identifier, setIdentifier] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<{
    identifier?: string;
    code?: string;
    nickname?: string;
    terms?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!identifier) {
      newErrors.identifier = registerType === 'phone'
        ? t('auth.phoneRequired')
        : t('auth.emailRequired');
    } else if (registerType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      newErrors.identifier = t('auth.emailInvalid');
    } else if (registerType === 'phone' && !/^\d{10,15}$/.test(identifier.replace(/\D/g, ''))) {
      newErrors.identifier = t('auth.phoneInvalid');
    }

    if (!verificationCode) {
      newErrors.code = t('auth.codeRequired');
    } else if (!/^\d{4,6}$/.test(verificationCode)) {
      newErrors.code = t('auth.codeInvalid');
    }

    if (!nickname.trim()) {
      newErrors.nickname = t('common.required');
    }

    if (!agreedToTerms) {
      newErrors.terms = t('auth.pleaseAgreeTerms');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendCode = () => {
    if (!identifier) {
      setErrors({
        identifier: registerType === 'phone'
          ? t('auth.phoneRequired')
          : t('auth.emailRequired'),
      });
      return;
    }

    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onSuccess?.({ identifier, type: registerType, nickname });
    } catch (error) {
      console.error('Register failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeSwitch = (type: 'phone' | 'email') => {
    setRegisterType(type);
    setIdentifier('');
    setVerificationCode('');
    setErrors({});
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('auth.registerTitle')}</h1>
        <p className={styles.subtitle}>{t('auth.registerSubtitle')}</p>
      </div>

      {/* 注册方式切换 */}
      <div className={styles.tabContainer}>
        <button
          className={clsx(styles.tab, { [styles.active]: registerType === 'phone' })}
          onClick={() => handleTypeSwitch('phone')}
        >
          <Phone size={18} />
          {t('auth.phone')}
        </button>
        <button
          className={clsx(styles.tab, { [styles.active]: registerType === 'email' })}
          onClick={() => handleTypeSwitch('email')}
        >
          <Mail size={18} />
          {t('auth.email')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label={registerType === 'phone' ? t('auth.phone') : t('auth.email')}
          type={registerType === 'email' ? 'email' : 'tel'}
          placeholder={registerType === 'phone' ? '+86 138 0000 0000' : 'example@email.com'}
          leftIcon={registerType === 'phone' ? <Phone size={18} /> : <Mail size={18} />}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={errors.identifier}
          required
        />

        <div className={styles.codeInput}>
          <Input
            label={t('auth.verificationCode')}
            type="text"
            placeholder="000000"
            maxLength={6}
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
            error={errors.code}
            required
            rightElement={
              <button
                type="button"
                className={styles.codeButton}
                onClick={handleSendCode}
                disabled={countdown > 0}
              >
                {countdown > 0
                  ? t('auth.countdown', { seconds: countdown })
                  : t('auth.getCode')
                }
              </button>
            }
          />
        </div>

        <Input
          label={t('user.nickname')}
          type="text"
          placeholder={t('user.nickname')}
          leftIcon={<User size={18} />}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          error={errors.nickname}
          required
        />

        {/* 服务条款 */}
        <div className={styles.termsWrapper}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
            />
            <span className={styles.checkmark}>
              {agreedToTerms && <Check size={14} />}
            </span>
            <span className={styles.termsText}>
              {t('auth.agreeTerms')}
              <button type="button" className={styles.link} onClick={onViewTerms}>
                {t('auth.termsOfService')}
              </button>
              {t('auth.and')}
              <button type="button" className={styles.link} onClick={onViewPrivacy}>
                {t('auth.privacyPolicy')}
              </button>
            </span>
          </label>
          {errors.terms && <span className={styles.errorText}>{errors.terms}</span>}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={isLoading}
          rightIcon={<ArrowRight size={20} />}
        >
          {t('auth.register')}
        </Button>
      </form>

      {/* 登录入口 */}
      <div className={styles.loginPrompt}>
        <span>{t('auth.hasAccount')}</span>
        <button
          type="button"
          className={styles.link}
          onClick={onSwitchToLogin}
        >
          {t('auth.goLogin')}
        </button>
      </div>
    </div>
  );
};

export default RegisterForm;
