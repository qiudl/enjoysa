import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService, type ApiSupplierDetail } from '../../../services/adminService';
import styles from '../../../pages/Admin/SupplierDetailPage/SupplierDetailPage.module.css';

interface EditSupplierModalProps {
  supplierId: number;
  supplier: ApiSupplierDetail['supplier'];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const EditSupplierModal: React.FC<EditSupplierModalProps> = ({
  supplierId,
  supplier,
  open,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  // Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Bank Info
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankBsb, setBankBsb] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  useEffect(() => {
    if (open && supplier) {
      setName(supplier.name || '');
      setDescription(supplier.description || '');
      setPhone(supplier.phone || '');
      setWebsite(supplier.website || '');
      setAddress(supplier.address || '');
      setCity(supplier.city || '');
      setState(supplier.state || '');
      setPostalCode(supplier.postal_code || '');
      setBankName(supplier.bank_name || '');
      setBankAccount(supplier.bank_account || '');
      setBankBsb(supplier.bank_bsb || '');
      setAccountHolder(supplier.account_holder || '');
    }
  }, [open, supplier]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminService.updateSupplier(supplierId, {
        name,
        description,
        phone,
        website,
        address,
        city,
        state,
        postal_code: postalCode,
        bank_name: bankName,
        bank_account: bankAccount,
        bank_bsb: bankBsb,
        account_holder: accountHolder,
      });
      onSaved();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2>{t('admin.suppliers.detail.editTitle')}</h2>

        {/* Basic Info Section */}
        <h3 className={styles.sectionTitle}>{t('admin.suppliers.detail.editBasicInfo')}</h3>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.namePlaceholder')}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.descriptionPlaceholder')}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.phone')}</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.phonePlaceholder')}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.website')}</label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.websitePlaceholder')}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.address')}</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.addressPlaceholder')}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.city')}</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.cityPlaceholder')}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.state')}</label>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.statePlaceholder')}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.postalCode')}</label>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.postalCodePlaceholder')}
          />
        </div>

        {/* Bank Info Section */}
        <h3 className={styles.sectionTitle}>{t('admin.suppliers.detail.editBankInfo')}</h3>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.bankName')}</label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.bankNamePlaceholder')}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.bankAccount')}</label>
          <input
            type="text"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.bankAccountPlaceholder')}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.bankBsb')}</label>
          <input
            type="text"
            value={bankBsb}
            onChange={(e) => setBankBsb(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.bankBsbPlaceholder')}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t('admin.suppliers.detail.editFields.accountHolder')}</label>
          <input
            type="text"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder={t('admin.suppliers.detail.editFields.accountHolderPlaceholder')}
          />
        </div>

        {/* Actions */}
        <div className={styles.formActions}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditSupplierModal;
