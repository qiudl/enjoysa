import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../Common/Button';
import { Input } from '../../Common/Input';
import { useRegion } from '../../../contexts/RegionContext';
import styles from './LoginForm.module.css';

export interface LoginFormProps {
  /** 登录函数 */
  onLogin?: (email: string, password: string) => Promise<boolean>;
  /** Google 登录函数 */
  onGoogleLogin?: (idToken: string) => Promise<boolean>;
  /** 登录成功回调 */
  onSuccess?: (data: { identifier: string; type: 'email' | 'phone' }) => void;
  /** 切换到注册 */
  onSwitchToRegister?: () => void;
  /** 忘记密码 */
  onForgotPassword?: () => void;
  /** 第三方登录 */
  onThirdPartyLogin?: (provider: 'wechat' | 'google') => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onLogin,
  onGoogleLogin,
  onSuccess,
  onSwitchToRegister,
  onForgotPassword,
}) => {
  const { t } = useTranslation();
  const { google_disabled: googleDisabled } = useRegion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    setIsLoading(true);
    setErrors({});
    try {
      if (onGoogleLogin) {
        const success = await onGoogleLogin(response.credential);
        if (success) {
          onSuccess?.({ identifier: '', type: 'email' });
        } else {
          setErrors({ general: t('auth.googleLoginFailed', 'Google login failed, please try again') });
        }
      }
    } catch {
      setErrors({ general: t('auth.networkError', 'Network error, please try again') });
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!email) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('auth.emailInvalid');
    }

    if (!password) {
      newErrors.password = t('auth.passwordRequired', 'Please enter your password');
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
      if (onLogin) {
        const success = await onLogin(email, password);
        if (success) {
          onSuccess?.({ identifier: email, type: 'email' });
        } else {
          setErrors({ general: t('auth.loginFailed', 'Invalid email or password') });
        }
      } else {
        // Fallback for storybook/demo
        await new Promise((resolve) => setTimeout(resolve, 1000));
        onSuccess?.({ identifier: email, type: 'email' });
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
            placeholder={t('auth.passwordPlaceholder', 'Enter your password')}
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

        <div className={styles.forgotPassword}>
          <button
            type="button"
            className={styles.link}
            onClick={onForgotPassword}
          >
            {t('auth.forgotPassword')}
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={isLoading}
          rightIcon={<ArrowRight size={20} />}
        >
          {t('auth.login')}
        </Button>
      </form>

      {/* 第三方登录 — REQ-20260506-0006: hidden in mainland CN where GSI is unreachable */}
      {!googleDisabled && (
        <>
          <div className={styles.divider}>
            <span>{t('auth.thirdPartyLogin')}</span>
          </div>

          <div className={styles.socialLogin}>
            <div className={styles.googleLoginWrapper}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setErrors({ general: t('auth.googleLoginFailed', 'Google login failed, please try again') })}
                width="100%"
                text="signin_with"
                shape="rectangular"
                size="large"
              />
            </div>
          </div>
        </>
      )}

      {/* 注册入口 */}
      <div className={styles.registerPrompt}>
        <span>{t('auth.noAccount')}</span>
        <button
          type="button"
          className={styles.link}
          onClick={onSwitchToRegister}
        >
          {t('auth.goRegister')}
        </button>
      </div>
    </div>
  );
};

export default LoginForm;
