import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Ban, Unlock, User, Edit2, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import styles from './UserTable.module.css';

export type UserStatus = 'active' | 'inactive' | 'banned';

export interface UserData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: UserStatus;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserTableProps {
  users: UserData[];
  loading?: boolean;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  onView?: (user: UserData) => void;
  onEdit?: (user: UserData) => void;
  onDelete?: (user: UserData) => void;
  onBan?: (user: UserData) => void;
  onUnban?: (user: UserData) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  loading = false,
  selectedIds = [],
  onSelect,
  onView,
  onEdit,
  onDelete,
  onBan,
  onUnban,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  const getStatusLabel = (status: UserStatus) => {
    const labels: Record<UserStatus, string> = {
      active: t('admin.users.status.active'),
      inactive: t('admin.users.status.inactive'),
      banned: t('admin.users.status.banned'),
    };
    return labels[status];
  };

  const formatPrice = (price: number) => {
    return `A$${price.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (onSelect) {
      onSelect(checked ? users.map((u) => u.id) : []);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (onSelect) {
      if (checked) {
        onSelect([...selectedIds, id]);
      } else {
        onSelect(selectedIds.filter((i) => i !== id));
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxCell}></th>
              <th>{t('admin.users.table.user')}</th>
              <th>{t('admin.users.table.email')}</th>
              <th>{t('admin.users.table.phone')}</th>
              <th>{t('admin.users.table.orders')}</th>
              <th>{t('admin.users.table.totalSpent')}</th>
              <th>{t('admin.users.table.status')}</th>
              <th>{t('admin.users.table.registerDate')}</th>
              <th>{t('admin.users.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className={styles.skeletonRow}>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
                <td><div className={styles.skeleton} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className={styles.empty}>
        <p>{t('admin.users.empty')}</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.checkboxCell}>
              <input
                type="checkbox"
                checked={selectedIds.length === users.length && users.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </th>
            <th>{t('admin.users.table.user')}</th>
            <th>{t('admin.users.table.email')}</th>
            <th>{t('admin.users.table.phone')}</th>
            <th>{t('admin.users.table.orders')}</th>
            <th>{t('admin.users.table.totalSpent')}</th>
            <th>{t('admin.users.table.status')}</th>
            <th>{t('admin.users.table.registerDate')}</th>
            <th>{t('admin.users.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className={clsx(selectedIds.includes(user.id) && styles.selected)}>
              <td className={styles.checkboxCell}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(user.id)}
                  onChange={(e) => handleSelectOne(user.id, e.target.checked)}
                />
              </td>
              <td>
                <div className={styles.userInfo}>
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      <User size={18} />
                    </div>
                  )}
                  <span className={styles.userName}>{user.name}</span>
                </div>
              </td>
              <td>
                <span className={styles.email}>{user.email}</span>
              </td>
              <td>
                <span className={styles.phone}>{user.phone || '-'}</span>
              </td>
              <td>
                <span className={styles.orderCount}>{user.orderCount}</span>
              </td>
              <td>
                <span className={styles.totalSpent}>{formatPrice(user.totalSpent)}</span>
              </td>
              <td>
                <span className={clsx(styles.statusBadge, styles[user.status])}>
                  {getStatusLabel(user.status)}
                </span>
              </td>
              <td>{formatDate(user.createdAt)}</td>
              <td>
                <div className={styles.actions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onView?.(user)}
                    title={t('admin.users.actions.view')}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onEdit?.(user)}
                    title={t('admin.users.actions.edit')}
                  >
                    <Edit2 size={16} />
                  </button>
                  {user.status !== 'banned' ? (
                    <button
                      className={clsx(styles.actionBtn, styles.ban)}
                      onClick={() => onBan?.(user)}
                      title={t('admin.users.actions.ban')}
                    >
                      <Ban size={16} />
                    </button>
                  ) : (
                    <button
                      className={clsx(styles.actionBtn, styles.unban)}
                      onClick={() => onUnban?.(user)}
                      title={t('admin.users.actions.unban')}
                    >
                      <Unlock size={16} />
                    </button>
                  )}
                  <button
                    className={clsx(styles.actionBtn, styles.deleteBtn)}
                    onClick={() => onDelete?.(user)}
                    title={t('admin.users.actions.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
