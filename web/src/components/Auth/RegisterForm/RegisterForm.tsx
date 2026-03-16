import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, User, ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../Common/Button';
import { Input } from '../../Common/Input';
import styles from './RegisterForm.module.css';

export interface RegisterFormProps {
  /** 注册函数 */
  onRegister?: (email: string, password: string, name: string) => Promise<boolean>;
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
  onRegister,
  onSuccess,
  onSwitchToLogin,
  onViewTerms,
  onViewPrivacy,
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    nickname?: string;
    terms?: string;
    general?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!email) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('auth.emailInvalid');
    }

    if (!password) {
      newErrors.password = t('auth.passwordRequired', 'Please enter a password');
    } else if (password.length < 8) {
      newErrors.password = t('auth.passwordTooShort', 'Password must be at least 8 characters');
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch', 'Passwords do not match');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      if (onRegister) {
        const success = await onRegister(email, password, nickname);
        if (success) {
          onSuccess?.({ identifier: email, type: 'email', nickname });
        } else {
          setErrors({ general: t('auth.registerFailed', 'Registration failed. Email may already be in use.') });
        }
      } else {
        // Fallback for storybook/demo
        await new Promise((resolve) => setTimeout(resolve, 1000));
        onSuccess?.({ identifier: email, type: 'email', nickname });
      }
    } catch {
      setErrors({ general: t('auth.networkError', 'Network error, please try again') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors.general && (
          <div className={styles.errorBanner}>{errors.general}</div>
        )}

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

        <Input
          label={t('auth.email')}
          type="email"
          placeholder="example@email.com"
          leftIcon={<Mail size={18} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />

        <div className={styles.passwordInput}>
          <Input
            label={t('auth.password', 'Password')}
            type={showPassword ? 'text' : 'password'}
            placeholder={t('auth.passwordPlaceholder', 'At least 8 characters')}
            leftIcon={<Lock size={18} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
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

        <Input
          label={t('auth.confirmPassword', 'Confirm Password')}
          type={showPassword ? 'text' : 'password'}
          placeholder={t('auth.confirmPasswordPlaceholder', 'Re-enter your password')}
          leftIcon={<Lock size={18} />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
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
