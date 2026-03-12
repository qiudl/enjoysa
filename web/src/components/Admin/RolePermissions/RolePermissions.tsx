import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldCheck, ShieldOff, Check, X, Edit2, Save } from 'lucide-react';
import clsx from 'clsx';
import type { AdminRole } from '../AdminTable';
import styles from './RolePermissions.module.css';

export interface Permission {
  key: string;
  labelZh: string;
  labelEn: string;
  description?: string;
}

export interface RoleConfig {
  role: AdminRole;
  labelZh: string;
  labelEn: string;
  permissions: string[];
  isEditable: boolean;
}

export interface RolePermissionsProps {
  roles: RoleConfig[];
  permissions: Permission[];
  onSave: (role: AdminRole, permissions: string[]) => void;
}

const DEFAULT_PERMISSIONS: Permission[] = [
  { key: 'dashboard.view', labelZh: '查看仪表盘', labelEn: 'View Dashboard' },
  { key: 'suppliers.view', labelZh: '查看供应商', labelEn: 'View Suppliers' },
  { key: 'suppliers.manage', labelZh: '管理供应商', labelEn: 'Manage Suppliers' },
  { key: 'products.view', labelZh: '查看产品', labelEn: 'View Products' },
  { key: 'products.review', labelZh: '审核产品', labelEn: 'Review Products' },
  { key: 'orders.view', labelZh: '查看订单', labelEn: 'View Orders' },
  { key: 'orders.manage', labelZh: '管理订单', labelEn: 'Manage Orders' },
  { key: 'users.view', labelZh: '查看用户', labelEn: 'View Users' },
  { key: 'users.manage', labelZh: '管理用户', labelEn: 'Manage Users' },
  { key: 'finance.view', labelZh: '查看财务', labelEn: 'View Finance' },
  { key: 'finance.manage', labelZh: '管理财务', labelEn: 'Manage Finance' },
  { key: 'admins.view', labelZh: '查看管理员', labelEn: 'View Admins' },
  { key: 'admins.manage', labelZh: '管理管理员', labelEn: 'Manage Admins' },
  { key: 'settings.view', labelZh: '查看设置', labelEn: 'View Settings' },
  { key: 'settings.manage', labelZh: '管理设置', labelEn: 'Manage Settings' },
];

const DEFAULT_ROLES: RoleConfig[] = [
  {
    role: 'super_admin',
    labelZh: '超级管理员',
    labelEn: 'Super Admin',
    permissions: DEFAULT_PERMISSIONS.map((p) => p.key),
    isEditable: false,
  },
  {
    role: 'admin',
    labelZh: '管理员',
    labelEn: 'Admin',
    permissions: DEFAULT_PERMISSIONS.filter((p) => !p.key.includes('admins.manage') && !p.key.includes('settings.manage')).map((p) => p.key),
    isEditable: true,
  },
  {
    role: 'operator',
    labelZh: '运营',
    labelEn: 'Operator',
    permissions: ['dashboard.view', 'suppliers.view', 'products.view', 'products.review', 'orders.view', 'orders.manage', 'users.view'],
    isEditable: true,
  },
  {
    role: 'viewer',
    labelZh: '只读',
    labelEn: 'Viewer',
    permissions: ['dashboard.view', 'suppliers.view', 'products.view', 'orders.view', 'users.view', 'finance.view'],
    isEditable: true,
  },
];

export const RolePermissions: React.FC<RolePermissionsProps> = ({
  roles = DEFAULT_ROLES,
  permissions = DEFAULT_PERMISSIONS,
  onSave,
}) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  const handleEdit = (role: RoleConfig) => {
    if (!role.isEditable) return;
    setEditingRole(role.role);
    setEditPermissions([...role.permissions]);
  };

  const handleCancel = () => {
    setEditingRole(null);
    setEditPermissions([]);
  };

  const handleSave = () => {
    if (editingRole) {
      onSave(editingRole, editPermissions);
      setEditingRole(null);
      setEditPermissions([]);
    }
  };

  const togglePermission = (key: string) => {
    setEditPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const getRoleIcon = (role: AdminRole) => {
    switch (role) {
      case 'super_admin':
        return <ShieldCheck size={18} className={styles.iconSuperAdmin} />;
      case 'admin':
        return <Shield size={18} className={styles.iconAdmin} />;
      case 'operator':
        return <Shield size={18} className={styles.iconOperator} />;
      case 'viewer':
        return <ShieldOff size={18} className={styles.iconViewer} />;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{isZh ? '角色权限配置' : 'Role Permissions'}</h3>
        <p className={styles.description}>
          {isZh
            ? '配置不同角色的访问权限。超级管理员拥有所有权限且不可修改。'
            : 'Configure access permissions for different roles. Super Admin has all permissions and cannot be modified.'}
        </p>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.permissionHeader}>{isZh ? '权限' : 'Permission'}</th>
              {roles.map((role) => (
                <th key={role.role} className={styles.roleHeader}>
                  <div className={styles.roleHeaderContent}>
                    {getRoleIcon(role.role)}
                    <span>{isZh ? role.labelZh : role.labelEn}</span>
                  </div>
                  {role.isEditable && (
                    <div className={styles.roleActions}>
                      {editingRole === role.role ? (
                        <>
                          <button
                            className={clsx(styles.roleBtn, styles.saveBtn)}
                            onClick={handleSave}
                            title={isZh ? '保存' : 'Save'}
                          >
                            <Save size={14} />
                          </button>
                          <button
                            className={clsx(styles.roleBtn, styles.cancelBtn)}
                            onClick={handleCancel}
                            title={isZh ? '取消' : 'Cancel'}
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          className={styles.roleBtn}
                          onClick={() => handleEdit(role)}
                          title={isZh ? '编辑' : 'Edit'}
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.key}>
                <td className={styles.permissionCell}>
                  <span className={styles.permissionLabel}>
                    {isZh ? permission.labelZh : permission.labelEn}
                  </span>
                </td>
                {roles.map((role) => {
                  const isEditing = editingRole === role.role;
                  const hasPermission = isEditing
                    ? editPermissions.includes(permission.key)
                    : role.permissions.includes(permission.key);

                  return (
                    <td key={`${role.role}-${permission.key}`} className={styles.checkCell}>
                      {isEditing ? (
                        <button
                          className={clsx(
                            styles.checkBtn,
                            hasPermission && styles.checked
                          )}
                          onClick={() => togglePermission(permission.key)}
                        >
                          {hasPermission ? <Check size={16} /> : null}
                        </button>
                      ) : (
                        <span className={clsx(styles.checkIcon, hasPermission && styles.checked)}>
                          {hasPermission ? <Check size={16} /> : <X size={16} />}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RolePermissions;
