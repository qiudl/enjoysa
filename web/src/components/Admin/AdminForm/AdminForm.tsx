import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Shield, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import type { AdminUser, AdminRole, AdminStatus } from '../AdminTable';
import styles from './AdminForm.module.css';

export interface AdminFormData {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: AdminRole;
  status: AdminStatus;
  permissions: string[];
}

export interface AdminFormProps {
  admin?: AdminUser | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AdminFormData) => void;
}

const ALL_PERMISSIONS = [
  { key: 'dashboard', labelZh: '仪表盘', labelEn: 'Dashboard' },
  { key: 'suppliers', labelZh: '供应商管理', labelEn: 'Supplier Management' },
  { key: 'products', labelZh: '产品审核', labelEn: 'Product Review' },
  { key: 'orders', labelZh: '订单管理', labelEn: 'Order Management' },
  { key: 'users', labelZh: '用户管理', labelEn: 'User Management' },
  { key: 'finance', labelZh: '财务管理', labelEn: 'Finance' },
  { key: 'admins', labelZh: '管理员管理', labelEn: 'Admin Management' },
  { key: 'settings', labelZh: '系统设置', labelEn: 'Settings' },
];

export const AdminForm: React.FC<AdminFormProps> = ({
  admin,
  open,
  onClose,
  onSubmit,
}) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';
  const isEditing = !!admin;

  const [formData, setFormData] = useState<AdminFormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'operator',
    status: 'active',
    permissions: [],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (admin) {
      setFormData({
        name: admin.name,
        email: admin.email,
        phone: admin.phone || '',
        password: '',
        role: admin.role,
        status: admin.status,
        permissions: admin.permissions,
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'admin',
        status: 'active',
        permissions: ['dashboard'],
      });
    }
    setErrors({});
  }, [admin, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = isZh ? '请输入姓名' : 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = isZh ? '请输入邮箱' : 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = isZh ? '请输入有效的邮箱地址' : 'Invalid email address';
    }

    if (!isEditing && !formData.password) {
      newErrors.password = isZh ? '请输入密码' : 'Password is required';
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = isZh ? '密码至少8位' : 'Password must be at least 8 characters';
    }

    if (formData.permissions.length === 0) {
      newErrors.permissions = isZh ? '请至少选择一个权限' : 'Select at least one permission';
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

  const handlePermissionToggle = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const handleSelectAllPermissions = () => {
    if (formData.permissions.length === ALL_PERMISSIONS.length) {
      setFormData((prev) => ({ ...prev, permissions: [] }));
    } else {
      setFormData((prev) => ({ ...prev, permissions: ALL_PERMISSIONS.map((p) => p.key) }));
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Shield size={20} />
            <h2>{isEditing ? (isZh ? '编辑管理员' : 'Edit Admin') : (isZh ? '添加管理员' : 'Add Admin')}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formBody}>
            {/* Basic Info */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{isZh ? '基本信息' : 'Basic Information'}</h3>

              <div className={styles.field}>
                <label>{isZh ? '姓名' : 'Name'} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={isZh ? '请输入姓名' : 'Enter name'}
                  className={clsx(errors.name && styles.error)}
                />
                {errors.name && <span className={styles.errorText}>{errors.name}</span>}
              </div>

              <div className={styles.field}>
                <label>{isZh ? '邮箱' : 'Email'} *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={isZh ? '请输入邮箱' : 'Enter email'}
                  className={clsx(errors.email && styles.error)}
                />
                {errors.email && <span className={styles.errorText}>{errors.email}</span>}
              </div>

              <div className={styles.field}>
                <label>{isZh ? '手机号' : 'Phone'}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={isZh ? '请输入手机号' : 'Enter phone number'}
                />
              </div>

              <div className={styles.field}>
                <label>{isEditing ? (isZh ? '新密码' : 'New Password') : (isZh ? '密码' : 'Password')} {!isEditing && '*'}</label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={isEditing ? (isZh ? '留空则不修改' : 'Leave empty to keep current') : (isZh ? '请输入密码' : 'Enter password')}
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

            {/* Role & Status */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{isZh ? '角色与状态' : 'Role & Status'}</h3>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>{isZh ? '角色' : 'Role'}</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as AdminRole })}
                    disabled={admin?.role === 'super_admin'}
                  >
                    <option value="super_admin">{isZh ? '超级管理员' : 'Super Admin'}</option>
                    <option value="admin">{isZh ? '管理员' : 'Admin'}</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label>{isZh ? '状态' : 'Status'}</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as AdminStatus })}
                    disabled={admin?.role === 'super_admin'}
                  >
                    <option value="active">{isZh ? '正常' : 'Active'}</option>
                    <option value="inactive">{isZh ? '未激活' : 'Inactive'}</option>
                    <option value="suspended">{isZh ? '已停用' : 'Suspended'}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Permissions */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>{isZh ? '权限设置' : 'Permissions'}</h3>
                <button
                  type="button"
                  className={styles.selectAllBtn}
                  onClick={handleSelectAllPermissions}
                >
                  {formData.permissions.length === ALL_PERMISSIONS.length
                    ? (isZh ? '取消全选' : 'Deselect All')
                    : (isZh ? '全选' : 'Select All')}
                </button>
              </div>
              {errors.permissions && <span className={styles.errorText}>{errors.permissions}</span>}

              <div className={styles.permissionsGrid}>
                {ALL_PERMISSIONS.map((perm) => (
                  <label key={perm.key} className={styles.permissionItem}>
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(perm.key)}
                      onChange={() => handlePermissionToggle(perm.key)}
                    />
                    <span>{isZh ? perm.labelZh : perm.labelEn}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              {isZh ? '取消' : 'Cancel'}
            </button>
            <button type="submit" className={styles.submitBtn}>
              {isEditing ? (isZh ? '保存' : 'Save') : (isZh ? '创建' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminForm;
