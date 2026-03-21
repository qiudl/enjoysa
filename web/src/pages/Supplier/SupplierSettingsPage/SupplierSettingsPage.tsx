import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header, Footer, Button } from '../../../components/Common';
import { get, put } from '../../../services/api';
import styles from './SupplierSettingsPage.module.css';

interface SupplierProfile {
  id: number;
  name: string;
  type: string;
  description: string;
  logo: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  bank_name: string;
  bank_account: string;
  bank_bsb: string;
  account_holder: string;
  auto_accept: boolean;
  notify_email: boolean;
  notify_sms: boolean;
}

export interface SupplierSettingsPageProps {
  supplierName?: string;
}

const supplierTypeLabels: Record<string, string> = {
  travel_agency: 'Travel Agency',
  hotel: 'Hotel',
  attraction: 'Attraction',
  restaurant: 'Restaurant',
  car_rental: 'Car Rental',
};

export const SupplierSettingsPage: React.FC<SupplierSettingsPageProps> = ({
  supplierName = '',
}) => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [editSection, setEditSection] = useState<'company' | 'bank' | null>(null);
  const [form, setForm] = useState<Partial<SupplierProfile>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    get<SupplierProfile>('/supplier/profile', 'supplier')
      .then((data) => setProfile(data))
      .catch(() => {});
  }, []);

  const startEdit = (section: 'company' | 'bank') => {
    if (!profile) return;
    setForm({ ...profile });
    setEditSection(section);
  };

  const cancelEdit = () => {
    setEditSection(null);
    setForm({});
  };

  const saveProfile = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const updated = await put<SupplierProfile>('/supplier/profile', form, 'supplier');
      setProfile(updated);
      setEditSection(null);
      setForm({});
      showToast(t('supplier.settings.saveSuccess', 'Saved successfully'));
    } catch {
      showToast(t('supplier.settings.saveFailed', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = async (key: 'auto_accept' | 'notify_email' | 'notify_sms') => {
    if (!profile) return;
    const updated = { ...profile, [key]: !profile[key] };
    try {
      const result = await put<SupplierProfile>('/supplier/profile', { [key]: updated[key] }, 'supplier');
      setProfile(result);
      showToast(t('supplier.settings.saveSuccess', 'Saved successfully'));
    } catch {
      showToast(t('supplier.settings.saveFailed', 'Save failed'));
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const emptyText = t('supplier.settings.notSet', 'Not set');

  return (
    <div className={styles.page}>
      <Header isLoggedIn userName={supplierName} />

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{t('supplier.settings.title', 'Settings')}</h1>
          </div>

          {/* Company Info */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{t('supplier.settings.companyInfo', 'Company Information')}</h2>
              {editSection !== 'company' && (
                <Button size="sm" variant="outline" onClick={() => startEdit('company')}>
                  {t('common.edit', 'Edit')}
                </Button>
              )}
            </div>
            <div className={styles.card}>
              {editSection === 'company' ? (
                <div className={styles.form}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>{t('supplier.settings.companyName', 'Company Name')}</label>
                    <input className={styles.formInput} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>{t('supplier.settings.type', 'Type')}</label>
                    <input className={styles.formInput} value={supplierTypeLabels[form.type || ''] || form.type || ''} disabled />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>{t('supplier.settings.description', 'Description')}</label>
                    <textarea className={styles.formTextarea} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>{t('supplier.settings.phone', 'Phone')}</label>
                      <input className={styles.formInput} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>{t('supplier.settings.website', 'Website')}</label>
                      <input className={styles.formInput} value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>{t('supplier.settings.address', 'Address')}</label>
                    <input className={styles.formInput} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>{t('supplier.settings.city', 'City')}</label>
                      <input className={styles.formInput} value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>{t('supplier.settings.state', 'State')}</label>
                      <input className={styles.formInput} value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>{t('supplier.settings.postalCode', 'Postal Code')}</label>
                    <input className={styles.formInput} value={form.postal_code || ''} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} style={{ maxWidth: '200px' }} />
                  </div>
                  <div className={styles.formActions}>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>{t('common.cancel', 'Cancel')}</Button>
                    <Button size="sm" variant="primary" onClick={saveProfile} loading={saving}>{t('common.save', 'Save')}</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.logoRow}>
                    <span className={styles.fieldLabel}>Logo</span>
                    {profile?.logo ? (
                      <img src={profile.logo} alt="Logo" className={styles.logoPreview} />
                    ) : (
                      <div className={styles.logoPlaceholder}>🏢</div>
                    )}
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('supplier.settings.companyName', 'Company Name')}</span>
                    <span className={styles.fieldValue}>{profile?.name || emptyText}</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('supplier.settings.type', 'Type')}</span>
                    <span className={styles.fieldValue}>
                      <span className={styles.typeBadge}>{supplierTypeLabels[profile?.type || ''] || profile?.type || emptyText}</span>
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('supplier.settings.description', 'Description')}</span>
                    <span className={`${styles.fieldValue} ${!profile?.description ? styles.fieldEmpty : ''}`}>
                      {profile?.description || emptyText}
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('supplier.settings.phone', 'Phone')}</span>
                    <span className={styles.fieldValue}>{profile?.phone || emptyText}</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('supplier.settings.website', 'Website')}</span>
                    <span className={`${styles.fieldValue} ${!profile?.website ? styles.fieldEmpty : ''}`}>
                      {profile?.website || emptyText}
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('supplier.settings.address', 'Address')}</span>
                    <span className={`${styles.fieldValue} ${!profile?.address ? styles.fieldEmpty : ''}`}>
                      {[profile?.address, profile?.city, profile?.state, profile?.postal_code].filter(Boolean).join(', ') || emptyText}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Bank Account */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{t('supplier.settings.bankAccount', 'Bank Account')}</h2>
              {editSection !== 'bank' && (
                <Button size="sm" variant="outline" onClick={() => startEdit('bank')}>
                  {t('common.edit', 'Edit')}
                </Button>
              )}
            </div>
            <div className={styles.card}>
              {editSection === 'bank' ? (
                <div className={styles.form}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>{t('supplier.settings.bankName', 'Bank Name')}</label>
                    <input className={styles.formInput} value={form.bank_name || ''} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>BSB</label>
                      <input className={styles.formInput} value={form.bank_bsb || ''} onChange={(e) => setForm({ ...form, bank_bsb: e.target.value })} placeholder="000-000" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>{t('supplier.settings.accountNumber', 'Account Number')}</label>
                      <input className={styles.formInput} value={form.bank_account || ''} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>{t('supplier.settings.accountHolder', 'Account Holder')}</label>
                    <input className={styles.formInput} value={form.account_holder || ''} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} />
                  </div>
                  <div className={styles.formActions}>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>{t('common.cancel', 'Cancel')}</Button>
                    <Button size="sm" variant="primary" onClick={saveProfile} loading={saving}>{t('common.save', 'Save')}</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('supplier.settings.bankName', 'Bank Name')}</span>
                    <span className={`${styles.fieldValue} ${!profile?.bank_name ? styles.fieldEmpty : ''}`}>
                      {profile?.bank_name || emptyText}
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>BSB</span>
                    <span className={`${styles.fieldValue} ${!profile?.bank_bsb ? styles.fieldEmpty : ''}`}>
                      {profile?.bank_bsb || emptyText}
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('supplier.settings.accountNumber', 'Account Number')}</span>
                    <span className={`${styles.fieldValue} ${!profile?.bank_account ? styles.fieldEmpty : ''}`}>
                      {profile?.bank_account || emptyText}
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('supplier.settings.accountHolder', 'Account Holder')}</span>
                    <span className={`${styles.fieldValue} ${!profile?.account_holder ? styles.fieldEmpty : ''}`}>
                      {profile?.account_holder || emptyText}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Notifications & Preferences */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{t('supplier.settings.preferences', 'Notifications & Preferences')}</h2>
            </div>
            <div className={styles.card}>
              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleLabel}>{t('supplier.settings.autoAccept', 'Auto Accept Orders')}</span>
                  <span className={styles.toggleDesc}>{t('supplier.settings.autoAcceptDesc', 'Automatically accept new orders without manual confirmation')}</span>
                </div>
                <button
                  className={`${styles.toggle} ${profile?.auto_accept ? styles.active : ''}`}
                  onClick={() => togglePreference('auto_accept')}
                />
              </div>
              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleLabel}>{t('supplier.settings.emailNotify', 'Email Notifications')}</span>
                  <span className={styles.toggleDesc}>{t('supplier.settings.emailNotifyDesc', 'Receive order and system notifications via email')}</span>
                </div>
                <button
                  className={`${styles.toggle} ${profile?.notify_email ? styles.active : ''}`}
                  onClick={() => togglePreference('notify_email')}
                />
              </div>
              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleLabel}>{t('supplier.settings.smsNotify', 'SMS Notifications')}</span>
                  <span className={styles.toggleDesc}>{t('supplier.settings.smsNotifyDesc', 'Receive order notifications via SMS')}</span>
                </div>
                <button
                  className={`${styles.toggle} ${profile?.notify_sms ? styles.active : ''}`}
                  onClick={() => togglePreference('notify_sms')}
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
};

export default SupplierSettingsPage;
