import React from 'react';
import { useTranslation } from 'react-i18next';
import { Store, Shield, UserCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import styles from './IdentityBadge.module.css';

type BadgeRole = 'supplier' | 'admin';

interface IdentityBadgeProps {
  role: BadgeRole;
}

export const IdentityBadge: React.FC<IdentityBadgeProps> = ({ role }) => {
  if (role === 'supplier') return <SupplierBadge />;
  return <AdminBadge />;
};

const SupplierBadge: React.FC = () => {
  const { t } = useTranslation();
  const { supplier } = useSupplierAuth();
  if (!supplier) return <GuestBadge />;
  const supplierName = supplier.supplier?.name ?? '';
  return (
    <span
      className={clsx(styles.badge, styles.supplier)}
      title={t('aiPanel.identity.activeAs', { defaultValue: '当前对话身份' }) as string}
    >
      <Store size={12} className={styles.icon} aria-hidden />
      <span className={styles.label}>
        {supplier.name}
        {supplierName && (
          <>
            <span className={styles.divider}>·</span>
            {supplierName}
          </>
        )}
      </span>
    </span>
  );
};

const AdminBadge: React.FC = () => {
  const { t } = useTranslation();
  const { admin } = useAdminAuth();
  if (!admin) return <GuestBadge />;
  return (
    <span
      className={clsx(styles.badge, styles.admin)}
      title={t('aiPanel.identity.activeAs', { defaultValue: '当前对话身份' }) as string}
    >
      <Shield size={12} className={styles.icon} aria-hidden />
      <span className={styles.label}>
        {admin.name}
        <span className={styles.divider}>·</span>
        {t('aiPanel.identity.admin', { defaultValue: '管理员' })}
      </span>
    </span>
  );
};

const GuestBadge: React.FC = () => {
  const { t } = useTranslation();
  return (
    <span className={clsx(styles.badge, styles.guest)}>
      <UserCircle2 size={12} className={styles.icon} aria-hidden />
      <span className={styles.label}>{t('aiPanel.identity.guest', { defaultValue: '访客' })}</span>
    </span>
  );
};

export default IdentityBadge;
