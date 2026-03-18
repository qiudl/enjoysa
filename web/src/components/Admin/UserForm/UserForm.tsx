import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, UserPlus, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import type { ApiUser } from '../../../services/adminService';
import styles from './UserForm.module.css';

export interface UserFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  status: string;
}

export interface UserFormProps {
  user?: ApiUser | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => void;
  loading?: boolean;
}

export const UserForm: React.FC<UserFormProps> = ({
  user,
  open,
  onClose,
  onSubmit,
  loading = false,
}) => {
  const { t } = useTranslation();
  const isEditing = !!user;

  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    status: 'active',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        password: '',
        status: user.status || 'active',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        status: 'active',
      });
    }
    setErrors({});
  }, [user, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('admin.users.form.errors.nameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('admin.users.form.errors.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('admin.users.form.errors.emailInvalid');
    }

    if (!isEditing && !formData.password) {
      newErrors.password = t('admin.users.form.errors.passwordRequired');
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = t('admin.users.form.errors.passwordMin');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <UserPlus size={20} />
            <h2>{isEditing ? t('admin.users.form.editTitle') : t('admin.users.form.createTitle')}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formBody}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{t('admin.users.form.basicInfo')}</h3>

              <div className={styles.field}>
                <label>{t('admin.users.form.name')} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('admin.users.form.namePlaceholder')}
                  className={clsx(errors.name && styles.error)}
                />
                {errors.name && <span className={styles.errorText}>{errors.name}</span>}
              </div>

              <div className={styles.field}>
                <label>{t('admin.users.form.email')} *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t('admin.users.form.emailPlaceholder')}
                  className={clsx(errors.email && styles.error)}
                />
                {errors.email && <span className={styles.errorText}>{errors.email}</span>}
              </div>

              <div className={styles.field}>
                <label>{t('admin.users.form.phone')}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t('admin.users.form.phonePlaceholder')}
                />
              </div>

              <div className={styles.field}>
                <label>
                  {isEditing ? t('admin.users.form.newPassword') : t('admin.users.form.password')}
                  {!isEditing && ' *'}
                </label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={isEditing ? t('admin.users.form.newPasswordPlaceholder') : t('admin.users.form.passwordPlaceholder')}
                    className={clsx(errors.password && styles.error)}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <span className={styles.errorText}>{errors.password}</span>}
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{t('admin.users.form.status')}</h3>
              <div className={styles.field}>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">{t('admin.users.form.statusActive')}</option>
                  <option value="suspended">{t('admin.users.form.statusSuspended')}</option>
                  <option value="banned">{t('admin.users.form.statusBanned')}</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading
                ? t('common.loading')
                : isEditing ? t('common.save') : t('admin.users.actions.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;
