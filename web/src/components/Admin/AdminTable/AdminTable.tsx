import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Edit2, Trash2, Shield, ShieldCheck, ShieldOff } from 'lucide-react';
import clsx from 'clsx';
import styles from './AdminTable.module.css';

export type AdminRole = 'super_admin' | 'admin' | 'operator' | 'viewer';
export type AdminStatus = 'active' | 'inactive' | 'suspended';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: AdminRole;
  status: AdminStatus;
  permissions: string[];
  lastLoginAt?: string;
  createdAt: string;
  createdBy?: string;
}

export interface AdminTableProps {
  admins: AdminUser[];
  loading?: boolean;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onView: (admin: AdminUser) => void;
  onEdit: (admin: AdminUser) => void;
  onDelete: (admin: AdminUser) => void;
  onToggleStatus: (admin: AdminUser) => void;
}

export const AdminTable: React.FC<AdminTableProps> = ({
  admins,
  loading,
  selectedIds,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelect(admins.map((a) => a.id));
    } else {
      onSelect([]);
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelect(selectedIds.filter((i) => i !== id));
    } else {
      onSelect([...selectedIds, id]);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString(isZh ? 'zh-CN' : 'en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleConfig = (role: AdminRole) => {
    const configs: Record<AdminRole, { label: string; icon: React.ReactNode; className: string }> = {
      super_admin: {
        label: isZh ? '超级管理员' : 'Super Admin',
        icon: <ShieldCheck size={14} />,
        className: styles.roleSuperAdmin,
      },
      admin: {
        label: isZh ? '管理员' : 'Admin',
        icon: <Shield size={14} />,
        className: styles.roleAdmin,
      },
      operator: {
        label: isZh ? '运营' : 'Operator',
        icon: <Shield size={14} />,
        className: styles.roleOperator,
      },
      viewer: {
        label: isZh ? '只读' : 'Viewer',
        icon: <ShieldOff size={14} />,
        className: styles.roleViewer,
      },
    };
    return configs[role];
  };

  const getStatusConfig = (status: AdminStatus) => {
    const configs: Record<AdminStatus, { label: string; className: string }> = {
      active: {
        label: isZh ? '正常' : 'Active',
        className: styles.statusActive,
      },
      inactive: {
        label: isZh ? '未激活' : 'Inactive',
        className: styles.statusInactive,
      },
      suspended: {
        label: isZh ? '已停用' : 'Suspended',
        className: styles.statusSuspended,
      },
    };
    return configs[status];
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  if (admins.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <Shield size={48} className={styles.emptyIcon} />
          <p>{isZh ? '暂无管理员数据' : 'No admin users found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.checkboxCell}>
              <input
                type="checkbox"
                checked={selectedIds.length === admins.length && admins.length > 0}
                onChange={handleSelectAll}
              />
            </th>
            <th>{isZh ? '管理员' : 'Admin'}</th>
            <th>{isZh ? '角色' : 'Role'}</th>
            <th>{isZh ? '状态' : 'Status'}</th>
            <th>{isZh ? '最后登录' : 'Last Login'}</th>
            <th>{isZh ? '创建时间' : 'Created'}</th>
            <th className={styles.actionsHeader}>{isZh ? '操作' : 'Actions'}</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((admin) => {
            const roleConfig = getRoleConfig(admin.role);
            const statusConfig = getStatusConfig(admin.status);
            return (
              <tr key={admin.id} className={clsx(selectedIds.includes(admin.id) && styles.selected)}>
                <td className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(admin.id)}
                    onChange={() => handleSelectOne(admin.id)}
                  />
                </td>
                <td>
                  <div className={styles.adminInfo}>
                    <div className={styles.avatar}>
                      {admin.avatar ? (
                        <img src={admin.avatar} alt={admin.name} />
                      ) : (
                        <span>{admin.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className={styles.adminDetails}>
                      <span className={styles.name}>{admin.name}</span>
                      <span className={styles.email}>{admin.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={clsx(styles.roleBadge, roleConfig.className)}>
                    {roleConfig.icon}
                    {roleConfig.label}
                  </span>
                </td>
                <td>
                  <span className={clsx(styles.statusBadge, statusConfig.className)}>
                    {statusConfig.label}
                  </span>
                </td>
                <td className={styles.dateCell}>{formatDateTime(admin.lastLoginAt)}</td>
                <td className={styles.dateCell}>{formatDate(admin.createdAt)}</td>
                <td>
                  <div className={styles.actions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => onView(admin)}
                      title={t('common.view')}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className={styles.actionBtn}
                      onClick={() => onEdit(admin)}
                      title={t('common.edit')}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className={clsx(styles.actionBtn, admin.status === 'active' ? styles.warn : styles.success)}
                      onClick={() => onToggleStatus(admin)}
                      title={admin.status === 'active' ? (isZh ? '停用' : 'Suspend') : (isZh ? '启用' : 'Activate')}
                    >
                      {admin.status === 'active' ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                    </button>
                    {admin.role !== 'super_admin' && (
                      <button
                        className={clsx(styles.actionBtn, styles.danger)}
                        onClick={() => onDelete(admin)}
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AdminTable;
