import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Mail, Lock, Eye, EyeOff, ArrowLeft, User, Phone, FileText } from 'lucide-react';
import { LanguageSwitcher } from '../../../components/Common';
import { post } from '../../../services/api';
import styles from './SupplierRegisterPage.module.css';

export interface SupplierRegisterPageProps {
  /** 注册成功回调 */
  onRegisterSuccess?: (data: { companyName: string; email: string }) => void;
  /** 返回登录页回调 */
  onBackToLogin?: () => void;
  /** 返回首页回调 */
  onNavigateHome?: () => void;
  /** 语言切换 */
  onLanguageChange?: (lang: 'zh' | 'en') => void;
}

type SupplierType = 'travel_agency' | 'hotel' | 'attraction' | 'restaurant' | 'car_rental';

export const SupplierRegisterPage: React.FC<SupplierRegisterPageProps> = ({
  onRegisterSuccess,
  onBackToLogin,
  onNavigateHome,
  onLanguageChange,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    companyName: '',
    supplierType: '' as SupplierType | '',
    contactName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    businessLicense: '',
    agreeTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLanguageChange = (lang: string) => {
    onLanguageChange?.(lang as 'zh' | 'en');
  };

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep1 = () => {
    if (!formData.companyName) {
      setError(t('supplier.register.errorCompanyRequired'));
      return false;
    }
    if (!formData.supplierType) {
      setError(t('supplier.register.errorTypeRequired'));
      return false;
    }
    if (!formData.contactName) {
      setError(t('supplier.register.errorContactRequired'));
      return false;
    }
    if (!formData.phone) {
      setError(t('supplier.register.errorPhoneRequired'));
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.email) {
      setError(t('supplier.register.errorEmailRequired'));
      return false;
    }
    if (!formData.password || formData.password.length < 8) {
      setError(t('supplier.register.errorPasswordLength'));
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(t('supplier.register.errorPasswordMismatch'));
      return false;
    }
    if (!formData.agreeTerms) {
      setError(t('supplier.register.errorAgreeTerms'));
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setIsLoading(true);
    try {
      await post('/supplier/register', {
        name: formData.companyName,
        type: formData.supplierType,
        contact_name: formData.contactName,
        phone: formData.phone,
        email: formData.email,
        contact_email: formData.email,
        password: formData.password,
        business_license: formData.businessLicense || undefined,
      });
      onRegisterSuccess?.({
        companyName: formData.companyName,
        email: formData.email,
      });
    } catch {
      setError(t('supplier.register.errorNetwork'));
    } finally {
      setIsLoading(false);
    }
  };

  const supplierTypes: { value: SupplierType; labelKey: string }[] = [
    { value: 'travel_agency', labelKey: 'supplier.types.travelAgency' },
    { value: 'hotel', labelKey: 'supplier.types.hotel' },
    { value: 'attraction', labelKey: 'supplier.types.scenic' },
    { value: 'restaurant', labelKey: 'supplier.types.restaurant' },
    { value: 'car_rental', labelKey: 'supplier.types.carRental' },
  ];

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
              {t('supplier.register.brandTitle')}
            </h1>
            <p className={styles.tagline}>EnjoySA Partner Portal</p>
            <ul className={styles.features}>
              <li>✅ {t('supplier.register.benefit1')}</li>
              <li>✅ {t('supplier.register.benefit2')}</li>
              <li>✅ {t('supplier.register.benefit3')}</li>
              <li>✅ {t('supplier.register.benefit4')}</li>
            </ul>
          </div>
          <div className={styles.brandingOverlay} />
        </div>

        {/* Right Side - Form */}
        <div className={styles.formSide}>
          <div className={styles.formContainer}>
            {/* Back Button */}
            <button className={styles.backButton} onClick={onNavigateHome}>
              <ArrowLeft size={18} />
              <span>{t('supplier.register.backToHome')}</span>
            </button>

            {/* Logo */}
            <div className={styles.formLogo}>
              <Building2 size={40} className={styles.formLogoIcon} />
              <span className={styles.formLogoText}>
                {t('supplier.register.title')}
              </span>
              <span className={styles.formLogoSubtext}>EnjoySA Partner</span>
            </div>

            {/* Progress Steps */}
            <div className={styles.steps}>
              <div className={`${styles.step} ${step >= 1 ? styles.active : ''}`}>
                <span className={styles.stepNumber}>1</span>
                <span className={styles.stepLabel}>{t('supplier.register.step1')}</span>
              </div>
              <div className={styles.stepLine} />
              <div className={`${styles.step} ${step >= 2 ? styles.active : ''}`}>
                <span className={styles.stepNumber}>2</span>
                <span className={styles.stepLabel}>{t('supplier.register.step2')}</span>
              </div>
            </div>

            {/* Form */}
            <form className={styles.form} onSubmit={handleSubmit}>
              {error && <div className={styles.error}>{error}</div>}

              {step === 1 ? (
                <>
                  {/* Company Name */}
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      {t('supplier.register.companyName')} *
                    </label>
                    <div className={styles.inputWrapper}>
                      <Building2 size={18} className={styles.inputIcon} />
                      <input
                        type="text"
                        className={styles.input}
                        placeholder={t('supplier.register.companyNamePlaceholder')}
                        value={formData.companyName}
                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Supplier Type */}
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      {t('supplier.register.supplierType')} *
                    </label>
                    <div className={styles.typeGrid}>
                      {supplierTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          className={`${styles.typeButton} ${
                            formData.supplierType === type.value ? styles.typeButtonActive : ''
                          }`}
                          onClick={() => handleInputChange('supplierType', type.value)}
                        >
                          {t(type.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contact Name */}
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      {t('supplier.register.contactName')} *
                    </label>
                    <div className={styles.inputWrapper}>
                      <User size={18} className={styles.inputIcon} />
                      <input
                        type="text"
                        className={styles.input}
                        placeholder={t('supplier.register.contactNamePlaceholder')}
                        value={formData.contactName}
                        onChange={(e) => handleInputChange('contactName', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      {t('supplier.register.phone')} *
                    </label>
                    <div className={styles.inputWrapper}>
                      <Phone size={18} className={styles.inputIcon} />
                      <input
                        type="tel"
                        className={styles.input}
                        placeholder={t('supplier.register.phonePlaceholder')}
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Business License (Optional) */}
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      {t('supplier.register.businessLicense')}
                    </label>
                    <div className={styles.inputWrapper}>
                      <FileText size={18} className={styles.inputIcon} />
                      <input
                        type="text"
                        className={styles.input}
                        placeholder={t('supplier.register.businessLicensePlaceholder')}
                        value={formData.businessLicense}
                        onChange={(e) => handleInputChange('businessLicense', e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.submitButton}
                    onClick={handleNextStep}
                  >
                    {t('supplier.register.nextStep')}
                  </button>
                </>
              ) : (
                <>
                  {/* Email */}
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      {t('supplier.register.email')} *
                    </label>
                    <div className={styles.inputWrapper}>
                      <Mail size={18} className={styles.inputIcon} />
                      <input
                        type="email"
                        className={styles.input}
                        placeholder={t('supplier.register.emailPlaceholder')}
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      {t('supplier.register.password')} *
                    </label>
                    <div className={styles.inputWrapper}>
                      <Lock size={18} className={styles.inputIcon} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={styles.input}
                        placeholder={t('supplier.register.passwordPlaceholder')}
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
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

                  {/* Confirm Password */}
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      {t('supplier.register.confirmPassword')} *
                    </label>
                    <div className={styles.inputWrapper}>
                      <Lock size={18} className={styles.inputIcon} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={styles.input}
                        placeholder={t('supplier.register.confirmPasswordPlaceholder')}
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Terms Agreement */}
                  <div className={styles.termsGroup}>
                    <label className={styles.termsLabel}>
                      <input
                        type="checkbox"
                        checked={formData.agreeTerms}
                        onChange={(e) => handleInputChange('agreeTerms', e.target.checked)}
                      />
                      <span>
                        {t('supplier.register.agreeTerms')}{' '}
                        <a href="/terms" target="_blank" rel="noopener noreferrer">
                          {t('supplier.register.termsLink')}
                        </a>
                      </span>
                    </label>
                  </div>

                  <div className={styles.buttonGroup}>
                    <button
                      type="button"
                      className={styles.backStepButton}
                      onClick={() => setStep(1)}
                    >
                      {t('supplier.register.prevStep')}
                    </button>
                    <button
                      type="submit"
                      className={styles.submitButton}
                      disabled={isLoading}
                    >
                      {isLoading
                        ? t('supplier.register.submitting')
                        : t('supplier.register.submitButton')}
                    </button>
                  </div>
                </>
              )}
            </form>

            {/* Back to Login */}
            <div className={styles.loginSection}>
              <p className={styles.loginText}>
                {t('supplier.register.hasAccount')}
              </p>
              <button className={styles.loginButton} onClick={onBackToLogin}>
                {t('supplier.register.backToLogin')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierRegisterPage;
