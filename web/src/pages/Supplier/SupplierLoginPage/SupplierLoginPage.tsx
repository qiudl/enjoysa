import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { LanguageSwitcher } from '../../../components/Common';
import styles from './SupplierLoginPage.module.css';

export interface SupplierLoginPageProps {
  /** 当前语言 */
  language?: 'zh' | 'en';
  /** 登录成功回调 */
  onLoginSuccess?: (supplier: { email: string; supplierName: string }) => void;
  /** 执行登录的函数 */
  onLogin?: (email: string, password: string) => Promise<boolean>;
  /** 申请入驻回调 */
  onApplyClick?: () => void;
  /** 返回首页回调 */
  onNavigateHome?: () => void;
  /** 语言切换 */
  onLanguageChange?: (lang: 'zh' | 'en') => void;
}

export const SupplierLoginPage: React.FC<SupplierLoginPageProps> = ({
  onLoginSuccess,
  onLogin,
  onApplyClick,
  onNavigateHome,
  onLanguageChange,
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setError(t('supplier.login.errorRequired', '请输入邮箱和密码'));
      return;
    }

    setIsLoading(true);

    try {
      // Use onLogin prop if provided, otherwise fallback to mock
      if (onLogin) {
        const success = await onLogin(email, password);
        if (success) {
          onLoginSuccess?.({ email, supplierName: email.split('@')[0] });
        } else {
          setError(t('supplier.login.errorInvalid', '邮箱或密码错误'));
        }
      } else {
        // Mock login for demo/storybook
        await new Promise((resolve) => setTimeout(resolve, 1000));
        onLoginSuccess?.({ email, supplierName: '祥龙旅行社' });
      }
    } catch {
      setError(t('supplier.login.errorNetwork', '网络错误，请重试'));
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
              <Building2 size={48} />
            </div>
            <h1 className={styles.logo}>
              {t('supplier.login.brandTitle', '供应商平台')}
            </h1>
            <p className={styles.tagline}>EnjoySA Partner Portal</p>
            <ul className={styles.features}>
              <li>🏨 {t('supplier.login.feature1', '酒店 / 民宿管理')}</li>
              <li>🎫 {t('supplier.login.feature2', '景点门票上架')}</li>
              <li>🚗 {t('supplier.login.feature3', '用车服务发布')}</li>
              <li>📊 {t('supplier.login.feature4', '订单数据分析')}</li>
              <li>💰 {t('supplier.login.feature5', '便捷财务结算')}</li>
            </ul>
          </div>
          <div className={styles.brandingOverlay} />
        </div>

        {/* Right Side - Form */}
        <div className={styles.formSide}>
          <div className={styles.formContainer}>
            {/* Back to Home */}
            <button className={styles.backButton} onClick={onNavigateHome}>
              <ArrowLeft size={18} />
              <span>{t('supplier.login.backToHome', '返回首页')}</span>
            </button>

            {/* Logo */}
            <div className={styles.formLogo}>
              <Building2 size={40} className={styles.formLogoIcon} />
              <span className={styles.formLogoText}>
                {t('supplier.login.title', '供应商登录')}
              </span>
              <span className={styles.formLogoSubtext}>EnjoySA Partner</span>
            </div>

            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>
                {t('supplier.login.welcomeBack', '欢迎回来')}
              </h2>
              <p className={styles.formSubtitle}>
                {t('supplier.login.subtitle', '登录管理您的产品、订单和结算')}
              </p>
            </div>

            {/* Login Form */}
            <form className={styles.form} onSubmit={handleSubmit}>
              {error && <div className={styles.error}>{error}</div>}

              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  {t('supplier.login.email', '邮箱')}
                </label>
                <div className={styles.inputWrapper}>
                  <Mail size={18} className={styles.inputIcon} />
                  <input
                    type="email"
                    className={styles.input}
                    placeholder={t('supplier.login.emailPlaceholder', '请输入邮箱')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  {t('supplier.login.password', '密码')}
                </label>
                <div className={styles.inputWrapper}>
                  <Lock size={18} className={styles.inputIcon} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.input}
                    placeholder={t('supplier.login.passwordPlaceholder', '请输入密码')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              <div className={styles.forgotPassword}>
                <a href="#forgot">{t('supplier.login.forgotPassword', '忘记密码?')}</a>
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={isLoading}
              >
                {isLoading
                  ? t('supplier.login.loggingIn', '登录中...')
                  : t('supplier.login.loginButton', '登录')}
              </button>
            </form>

            {/* Apply Section */}
            <div className={styles.applySection}>
              <p className={styles.applyText}>
                {t('supplier.login.noAccount', '还没有供应商账号?')}
              </p>
              <button className={styles.applyButton} onClick={onApplyClick}>
                {t('supplier.login.applyNow', '申请入驻')}
              </button>
            </div>

            {/* Supplier Types */}
            <div className={styles.supplierTypes}>
              <p className={styles.typesTitle}>
                {t('supplier.login.supportTypes', '支持入驻类型')}
              </p>
              <div className={styles.typesList}>
                <span className={styles.typeTag}>
                  {t('supplier.types.travelAgency', '旅行社')}
                </span>
                <span className={styles.typeTag}>
                  {t('supplier.types.hotel', '酒店')}
                </span>
                <span className={styles.typeTag}>
                  {t('supplier.types.scenic', '景区')}
                </span>
                <span className={styles.typeTag}>
                  {t('supplier.types.restaurant', '餐厅')}
                </span>
                <span className={styles.typeTag}>
                  {t('supplier.types.carRental', '租车')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierLoginPage;
