import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Globe,
  CreditCard,
  Bell,
  Shield,
  Save,
  RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';
import styles from './SettingsPage.module.css';

type TabKey = 'general' | 'payments' | 'notifications' | 'security';

interface GeneralSettings {
  siteName: string;
  siteNameEn: string;
  siteUrl: string;
  contactEmail: string;
  contactPhone: string;
  defaultLanguage: 'zh' | 'en';
  timezone: string;
  currency: string;
}

interface PaymentSettings {
  wechatEnabled: boolean;
  alipayEnabled: boolean;
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  defaultCommissionRate: number;
  minWithdrawal: number;
  settlementCycle: 'weekly' | 'biweekly' | 'monthly';
}

interface NotificationSettings {
  emailNewOrder: boolean;
  emailOrderStatus: boolean;
  emailNewSupplier: boolean;
  emailDailyReport: boolean;
  smsNewOrder: boolean;
  smsOrderStatus: boolean;
}

interface SecuritySettings {
  twoFactorRequired: boolean;
  sessionTimeout: number;
  passwordMinLength: number;
  passwordRequireSpecial: boolean;
  ipWhitelist: string;
}

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [saving, setSaving] = useState(false);

  // General settings state
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    siteName: '畅游南澳',
    siteNameEn: 'EnjoySA',
    siteUrl: 'https://enjoysa.com.au',
    contactEmail: 'support@enjoysa.com.au',
    contactPhone: '+61 8 1234 5678',
    defaultLanguage: 'zh',
    timezone: 'Australia/Adelaide',
    currency: 'AUD',
  });

  // Payment settings state
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    wechatEnabled: true,
    alipayEnabled: true,
    stripeEnabled: true,
    paypalEnabled: false,
    defaultCommissionRate: 15,
    minWithdrawal: 100,
    settlementCycle: 'biweekly',
  });

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNewOrder: true,
    emailOrderStatus: true,
    emailNewSupplier: true,
    emailDailyReport: false,
    smsNewOrder: false,
    smsOrderStatus: false,
  });

  // Security settings state
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    twoFactorRequired: false,
    sessionTimeout: 30,
    passwordMinLength: 8,
    passwordRequireSpecial: true,
    ipWhitelist: '',
  });

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'general', label: t('admin.settings.general'), icon: <Globe size={18} /> },
    { key: 'payments', label: t('admin.settings.payments'), icon: <CreditCard size={18} /> },
    { key: 'notifications', label: t('admin.settings.notifications'), icon: <Bell size={18} /> },
    { key: 'security', label: t('admin.settings.security'), icon: <Shield size={18} /> },
  ];

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    // Show success message
    console.log('Settings saved');
  };

  const handleReset = () => {
    // Reset to default values
    console.log('Settings reset');
  };

  const renderGeneralSettings = () => (
    <div className={styles.settingsForm}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>{t('admin.settings.generalSettings.siteInfo')}</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.generalSettings.siteName')}</label>
            <input
              type="text"
              value={generalSettings.siteName}
              onChange={(e) => setGeneralSettings({ ...generalSettings, siteName: e.target.value })}
            />
          </div>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.generalSettings.siteNameEn')}</label>
            <input
              type="text"
              value={generalSettings.siteNameEn}
              onChange={(e) => setGeneralSettings({ ...generalSettings, siteNameEn: e.target.value })}
            />
          </div>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.generalSettings.siteUrl')}</label>
            <input
              type="url"
              value={generalSettings.siteUrl}
              onChange={(e) => setGeneralSettings({ ...generalSettings, siteUrl: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>{t('admin.settings.generalSettings.contact')}</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.generalSettings.contactEmail')}</label>
            <input
              type="email"
              value={generalSettings.contactEmail}
              onChange={(e) => setGeneralSettings({ ...generalSettings, contactEmail: e.target.value })}
            />
          </div>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.generalSettings.contactPhone')}</label>
            <input
              type="tel"
              value={generalSettings.contactPhone}
              onChange={(e) => setGeneralSettings({ ...generalSettings, contactPhone: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>{t('admin.settings.generalSettings.regional')}</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.generalSettings.defaultLanguage')}</label>
            <select
              value={generalSettings.defaultLanguage}
              onChange={(e) => setGeneralSettings({ ...generalSettings, defaultLanguage: e.target.value as 'zh' | 'en' })}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.generalSettings.timezone')}</label>
            <select
              value={generalSettings.timezone}
              onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
            >
              <option value="Australia/Adelaide">Australia/Adelaide (ACST)</option>
              <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
              <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.generalSettings.currency')}</label>
            <select
              value={generalSettings.currency}
              onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
            >
              <option value="AUD">AUD - Australian Dollar</option>
              <option value="CNY">CNY - Chinese Yuan</option>
              <option value="USD">USD - US Dollar</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPaymentSettings = () => (
    <div className={styles.settingsForm}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>{t('admin.settings.paymentSettings.methods')}</h3>
        <div className={styles.toggleList}>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.paymentSettings.wechat')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.paymentSettings.wechatDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={paymentSettings.wechatEnabled}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, wechatEnabled: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.paymentSettings.alipay')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.paymentSettings.alipayDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={paymentSettings.alipayEnabled}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, alipayEnabled: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.paymentSettings.stripe')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.paymentSettings.stripeDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={paymentSettings.stripeEnabled}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, stripeEnabled: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.paymentSettings.paypal')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.paymentSettings.paypalDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={paymentSettings.paypalEnabled}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, paypalEnabled: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>{t('admin.settings.paymentSettings.settlement')}</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.paymentSettings.commissionRate')}</label>
            <div className={styles.inputWithSuffix}>
              <input
                type="number"
                value={paymentSettings.defaultCommissionRate}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, defaultCommissionRate: Number(e.target.value) })}
                min={0}
                max={100}
              />
              <span>%</span>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.paymentSettings.minWithdrawal')}</label>
            <div className={styles.inputWithPrefix}>
              <span>A$</span>
              <input
                type="number"
                value={paymentSettings.minWithdrawal}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, minWithdrawal: Number(e.target.value) })}
                min={0}
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.paymentSettings.settlementCycle')}</label>
            <select
              value={paymentSettings.settlementCycle}
              onChange={(e) => setPaymentSettings({ ...paymentSettings, settlementCycle: e.target.value as 'weekly' | 'biweekly' | 'monthly' })}
            >
              <option value="weekly">{t('admin.settings.paymentSettings.weekly')}</option>
              <option value="biweekly">{t('admin.settings.paymentSettings.biweekly')}</option>
              <option value="monthly">{t('admin.settings.paymentSettings.monthly')}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className={styles.settingsForm}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>{t('admin.settings.notificationSettings.email')}</h3>
        <div className={styles.toggleList}>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.notificationSettings.newOrder')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.notificationSettings.newOrderDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={notificationSettings.emailNewOrder}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNewOrder: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.notificationSettings.orderStatus')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.notificationSettings.orderStatusDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={notificationSettings.emailOrderStatus}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, emailOrderStatus: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.notificationSettings.newSupplier')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.notificationSettings.newSupplierDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={notificationSettings.emailNewSupplier}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNewSupplier: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.notificationSettings.dailyReport')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.notificationSettings.dailyReportDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={notificationSettings.emailDailyReport}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, emailDailyReport: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>{t('admin.settings.notificationSettings.sms')}</h3>
        <div className={styles.toggleList}>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.notificationSettings.smsNewOrder')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.notificationSettings.smsNewOrderDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={notificationSettings.smsNewOrder}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, smsNewOrder: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.notificationSettings.smsOrderStatus')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.notificationSettings.smsOrderStatusDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={notificationSettings.smsOrderStatus}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, smsOrderStatus: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className={styles.settingsForm}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>{t('admin.settings.securitySettings.authentication')}</h3>
        <div className={styles.toggleList}>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.securitySettings.twoFactor')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.securitySettings.twoFactorDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={securitySettings.twoFactorRequired}
                onChange={(e) => setSecuritySettings({ ...securitySettings, twoFactorRequired: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.securitySettings.sessionTimeout')}</label>
            <div className={styles.inputWithSuffix}>
              <input
                type="number"
                value={securitySettings.sessionTimeout}
                onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: Number(e.target.value) })}
                min={5}
                max={480}
              />
              <span>{t('admin.settings.securitySettings.minutes')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>{t('admin.settings.securitySettings.password')}</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>{t('admin.settings.securitySettings.minLength')}</label>
            <div className={styles.inputWithSuffix}>
              <input
                type="number"
                value={securitySettings.passwordMinLength}
                onChange={(e) => setSecuritySettings({ ...securitySettings, passwordMinLength: Number(e.target.value) })}
                min={6}
                max={32}
              />
              <span>{t('admin.settings.securitySettings.characters')}</span>
            </div>
          </div>
        </div>
        <div className={styles.toggleList}>
          <div className={styles.toggleItem}>
            <div>
              <span className={styles.toggleLabel}>{t('admin.settings.securitySettings.requireSpecial')}</span>
              <span className={styles.toggleDesc}>{t('admin.settings.securitySettings.requireSpecialDesc')}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={securitySettings.passwordRequireSpecial}
                onChange={(e) => setSecuritySettings({ ...securitySettings, passwordRequireSpecial: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>{t('admin.settings.securitySettings.access')}</h3>
        <div className={styles.formGroup} style={{ maxWidth: '100%' }}>
          <label>{t('admin.settings.securitySettings.ipWhitelist')}</label>
          <textarea
            value={securitySettings.ipWhitelist}
            onChange={(e) => setSecuritySettings({ ...securitySettings, ipWhitelist: e.target.value })}
            placeholder={t('admin.settings.securitySettings.ipWhitelistPlaceholder')}
            rows={4}
          />
          <span className={styles.formHint}>{t('admin.settings.securitySettings.ipWhitelistHint')}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Settings size={24} />
        </div>
        <div>
          <h1 className={styles.title}>{t('admin.settings.title')}</h1>
          <p className={styles.subtitle}>{t('admin.settings.subtitle')}</p>
        </div>
      </div>

      <div className={styles.container}>
        <div className={styles.sidebar}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={clsx(styles.tabBtn, activeTab === tab.key && styles.active)}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {activeTab === 'general' && renderGeneralSettings()}
          {activeTab === 'payments' && renderPaymentSettings()}
          {activeTab === 'notifications' && renderNotificationSettings()}
          {activeTab === 'security' && renderSecuritySettings()}

          <div className={styles.actions}>
            <button className={styles.btnReset} onClick={handleReset}>
              <RotateCcw size={18} />
              <span>{t('admin.settings.reset')}</span>
            </button>
            <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
              <Save size={18} />
              <span>{saving ? t('admin.settings.saving') : t('admin.settings.save')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
