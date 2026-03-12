import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { SupplierType } from '../SupplierTable';
import styles from './SupplierForm.module.css';

export interface SupplierFormData {
  name: string;
  nameEn?: string;
  type: SupplierType;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address?: string;
  addressEn?: string;
  businessLicense?: string;
  description?: string;
  descriptionEn?: string;
  logo?: string;
  commissionRate?: number;
}

export interface SupplierFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: Partial<SupplierFormData>;
  onClose: () => void;
  onSubmit: (data: SupplierFormData) => Promise<void>;
}

const defaultFormData: SupplierFormData = {
  name: '',
  nameEn: '',
  type: 'travel_agency',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  addressEn: '',
  businessLicense: '',
  description: '',
  descriptionEn: '',
  commissionRate: 10,
};

export const SupplierForm: React.FC<SupplierFormProps> = ({
  open,
  mode,
  initialData,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<SupplierFormData>(defaultFormData);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialData) {
        setFormData({ ...defaultFormData, ...initialData });
      } else {
        setFormData(defaultFormData);
      }
      setErrors({});
    }
  }, [open, mode, initialData]);

  const supplierTypes: { value: SupplierType; label: string }[] = [
    { value: 'travel_agency', label: t('supplier.types.travel_agency') },
    { value: 'hotel', label: t('supplier.types.hotel') },
    { value: 'attraction', label: t('supplier.types.attraction') },
    { value: 'restaurant', label: t('supplier.types.restaurant') },
    { value: 'car_rental', label: t('supplier.types.car_rental') },
  ];

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('admin.suppliers.form.errors.nameRequired');
    }
    if (!formData.contactName.trim()) {
      newErrors.contactName = t('admin.suppliers.form.errors.contactNameRequired');
    }
    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = t('admin.suppliers.form.errors.phoneRequired');
    }
    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = t('admin.suppliers.form.errors.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = t('admin.suppliers.form.errors.emailInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof SupplierFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  if (!open) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {mode === 'create'
              ? t('admin.suppliers.form.createTitle')
              : t('admin.suppliers.form.editTitle')}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('admin.suppliers.form.basicInfo')}</h3>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                {t('admin.suppliers.form.name')} <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={clsx(styles.input, errors.name && styles.inputError)}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={t('admin.suppliers.form.namePlaceholder')}
              />
              {errors.name && <span className={styles.error}>{errors.name}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>{t('admin.suppliers.form.nameEn')}</label>
              <input
                type="text"
                className={styles.input}
                value={formData.nameEn}
                onChange={(e) => handleChange('nameEn', e.target.value)}
                placeholder={t('admin.suppliers.form.nameEnPlaceholder')}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                {t('admin.suppliers.form.type')} <span className={styles.required}>*</span>
              </label>
              <select
                className={styles.select}
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value as SupplierType)}
              >
                {supplierTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>{t('admin.suppliers.form.businessLicense')}</label>
              <input
                type="text"
                className={styles.input}
                value={formData.businessLicense}
                onChange={(e) => handleChange('businessLicense', e.target.value)}
                placeholder={t('admin.suppliers.form.businessLicensePlaceholder')}
              />
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('admin.suppliers.form.contactInfo')}</h3>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                {t('admin.suppliers.form.contactName')} <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={clsx(styles.input, errors.contactName && styles.inputError)}
                value={formData.contactName}
                onChange={(e) => handleChange('contactName', e.target.value)}
                placeholder={t('admin.suppliers.form.contactNamePlaceholder')}
              />
              {errors.contactName && <span className={styles.error}>{errors.contactName}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                {t('admin.suppliers.form.contactPhone')} <span className={styles.required}>*</span>
              </label>
              <input
                type="tel"
                className={clsx(styles.input, errors.contactPhone && styles.inputError)}
                value={formData.contactPhone}
                onChange={(e) => handleChange('contactPhone', e.target.value)}
                placeholder={t('admin.suppliers.form.contactPhonePlaceholder')}
              />
              {errors.contactPhone && <span className={styles.error}>{errors.contactPhone}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                {t('admin.suppliers.form.contactEmail')} <span className={styles.required}>*</span>
              </label>
              <input
                type="email"
                className={clsx(styles.input, errors.contactEmail && styles.inputError)}
                value={formData.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder={t('admin.suppliers.form.contactEmailPlaceholder')}
              />
              {errors.contactEmail && <span className={styles.error}>{errors.contactEmail}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>{t('admin.suppliers.form.address')}</label>
              <input
                type="text"
                className={styles.input}
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder={t('admin.suppliers.form.addressPlaceholder')}
              />
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('admin.suppliers.form.commissionSettings')}</h3>

            <div className={styles.formGroup}>
              <label className={styles.label}>{t('admin.suppliers.form.commissionRate')}</label>
              <div className={styles.inputWithSuffix}>
                <input
                  type="number"
                  className={styles.input}
                  value={formData.commissionRate}
                  onChange={(e) => handleChange('commissionRate', parseFloat(e.target.value) || 0)}
                  min={0}
                  max={100}
                  step={0.1}
                />
                <span className={styles.suffix}>%</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('admin.suppliers.form.description')}</h3>

            <div className={styles.formGroup}>
              <label className={styles.label}>{t('admin.suppliers.form.descriptionZh')}</label>
              <textarea
                className={styles.textarea}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder={t('admin.suppliers.form.descriptionPlaceholder')}
                rows={3}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>{t('admin.suppliers.form.descriptionEn')}</label>
              <textarea
                className={styles.textarea}
                value={formData.descriptionEn}
                onChange={(e) => handleChange('descriptionEn', e.target.value)}
                placeholder={t('admin.suppliers.form.descriptionEnPlaceholder')}
                rows={3}
              />
            </div>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={clsx(styles.btn, styles.btnSecondary)}
              onClick={onClose}
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={clsx(styles.btn, styles.btnPrimary)}
              disabled={loading}
            >
              {loading && <Loader2 size={16} className={styles.spinner} />}
              {mode === 'create' ? t('common.submit') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default SupplierForm;
