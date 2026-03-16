import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../Common/Button';
import { Input } from '../../Common/Input';
import styles from './LoginForm.module.css';

export interface LoginFormProps {
  /** 登录函数 */
  onLogin?: (email: string, password: string) => Promise<boolean>;
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
  onSuccess,
  onSwitchToRegister,
  onForgotPassword,
  onThirdPartyLogin,
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

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

      {/* 第三方登录 */}
      <div className={styles.divider}>
        <span>{t('auth.thirdPartyLogin')}</span>
      </div>

      <div className={styles.socialLogin}>
        <button
          type="button"
          className={clsx(styles.socialButton, styles.wechat)}
          onClick={() => onThirdPartyLogin?.('wechat')}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M8.69 13.3c-.46 0-.84-.37-.84-.84s.38-.84.84-.84.84.37.84.84-.38.84-.84.84zm5.62 0c-.46 0-.84-.37-.84-.84s.38-.84.84-.84.84.37.84.84-.38.84-.84.84z"/>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.5 12.59c-.17.5-.71.84-1.3.84-.26 0-.51-.06-.73-.17l-1.75-.94-1.1.58c-.19.1-.4.15-.62.15-.45 0-.88-.18-1.2-.5l-.47-.47c-.23-.23-.37-.54-.37-.87v-.4c-.73-.26-1.36-.72-1.82-1.31-.46-.59-.73-1.3-.73-2.08 0-2.03 1.76-3.68 3.93-3.68s3.93 1.65 3.93 3.68c0 .78-.27 1.5-.73 2.08-.46.59-1.09 1.05-1.82 1.31v.4c0 .22.08.43.22.6l.83.83c.17.17.4.27.64.27.13 0 .26-.03.38-.08l1.43-.75.65.35c.22.12.5.12.72 0l.62-.33c.32-.17.57-.46.68-.81.11-.35.07-.74-.11-1.06-.18-.32-.47-.56-.82-.67-.35-.11-.74-.07-1.06.11z"/>
          </svg>
          {t('auth.wechatLogin')}
        </button>
        <button
          type="button"
          className={clsx(styles.socialButton, styles.google)}
          onClick={() => onThirdPartyLogin?.('google')}
        >
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t('auth.googleLogin')}
        </button>
      </div>

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
