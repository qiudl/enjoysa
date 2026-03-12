import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Building2,
  Mail,
  Phone,
  Calendar,
  Package,
  ShoppingCart,
  FileText,
  CheckCircle,
  XCircle,
  Ban,
} from 'lucide-react';
import clsx from 'clsx';
import type { Supplier, SupplierStatus, SupplierType } from '../SupplierTable';
import styles from './SupplierDetail.module.css';

export interface SupplierDetailProps {
  supplier: Supplier | null;
  open: boolean;
  onClose: () => void;
  onApprove?: (supplier: Supplier) => void;
  onReject?: (supplier: Supplier, reason: string) => void;
  onSuspend?: (supplier: Supplier, reason: string) => void;
  onUnsuspend?: (supplier: Supplier) => void;
}

export const SupplierDetail: React.FC<SupplierDetailProps> = ({
  supplier,
  open,
  onClose,
  onApprove,
  onReject,
  onSuspend,
  onUnsuspend,
}) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'info' | 'products' | 'orders'>('info');
  const [rejectReason, setRejectReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  if (!open || !supplier) return null;

  const getStatusLabel = (status: SupplierStatus) => {
    const labels: Record<SupplierStatus, string> = {
      pending: t('admin.suppliers.status.pending'),
      approved: t('admin.suppliers.status.approved'),
      rejected: t('admin.suppliers.status.rejected'),
      suspended: t('admin.suppliers.status.suspended'),
    };
    return labels[status];
  };

  const getTypeLabel = (type: SupplierType) => {
    const labels: Record<SupplierType, string> = {
      travel_agency: t('supplier.types.travel_agency'),
      hotel: t('supplier.types.hotel'),
      attraction: t('supplier.types.attraction'),
      restaurant: t('supplier.types.restaurant'),
      car_rental: t('supplier.types.car_rental'),
    };
    return labels[type];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleReject = () => {
    if (rejectReason.trim() && onReject) {
      onReject(supplier, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
    }
  };

  const handleSuspend = () => {
    if (suspendReason.trim() && onSuspend) {
      onSuspend(supplier, suspendReason);
      setShowSuspendModal(false);
      setSuspendReason('');
    }
  };

  const tabs = [
    { key: 'info', label: t('admin.suppliers.detail.tabs.info'), icon: <FileText size={16} /> },
    { key: 'products', label: t('admin.suppliers.detail.tabs.products'), icon: <Package size={16} /> },
    { key: 'orders', label: t('admin.suppliers.detail.tabs.orders'), icon: <ShoppingCart size={16} /> },
  ];

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('admin.suppliers.detail.title')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.supplierHeader}>
          <div className={styles.supplierInfo}>
            {supplier.logo ? (
              <img src={supplier.logo} alt="" className={styles.logo} />
            ) : (
              <div className={styles.logoPlaceholder}>
                <Building2 size={32} />
              </div>
            )}
            <div className={styles.supplierMeta}>
              <h3 className={styles.supplierName}>{supplier.name}</h3>
              {supplier.nameEn && (
                <p className={styles.supplierNameEn}>{supplier.nameEn}</p>
              )}
              <div className={styles.tags}>
                <span className={styles.typeTag}>{getTypeLabel(supplier.type)}</span>
                <span className={clsx(styles.statusBadge, styles[supplier.status])}>
                  {getStatusLabel(supplier.status)}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{supplier.productCount}</span>
              <span className={styles.statLabel}>{t('admin.suppliers.detail.products')}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{supplier.orderCount}</span>
              <span className={styles.statLabel}>{t('admin.suppliers.detail.orders')}</span>
            </div>
          </div>
        </div>

        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={clsx(styles.tab, activeTab === tab.key && styles.active)}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {activeTab === 'info' && (
            <div className={styles.infoSection}>
              <h4 className={styles.sectionTitle}>{t('admin.suppliers.detail.contactInfo')}</h4>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Mail size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.suppliers.detail.email')}</span>
                    <span className={styles.infoValue}>{supplier.contactEmail}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Phone size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.suppliers.detail.phone')}</span>
                    <span className={styles.infoValue}>{supplier.contactPhone}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Building2 size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.suppliers.detail.contactPerson')}</span>
                    <span className={styles.infoValue}>{supplier.contactName}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Calendar size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.suppliers.detail.joinDate')}</span>
                    <span className={styles.infoValue}>{formatDate(supplier.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className={styles.placeholder}>
              <Package size={48} />
              <p>{t('admin.suppliers.detail.productsPlaceholder')}</p>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className={styles.placeholder}>
              <ShoppingCart size={48} />
              <p>{t('admin.suppliers.detail.ordersPlaceholder')}</p>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {supplier.status === 'pending' && (
            <>
              <button
                className={clsx(styles.btn, styles.btnReject)}
                onClick={() => setShowRejectModal(true)}
              >
                <XCircle size={16} />
                <span>{t('admin.suppliers.actions.reject')}</span>
              </button>
              <button
                className={clsx(styles.btn, styles.btnApprove)}
                onClick={() => onApprove?.(supplier)}
              >
                <CheckCircle size={16} />
                <span>{t('admin.suppliers.actions.approve')}</span>
              </button>
            </>
          )}
          {supplier.status === 'approved' && (
            <button
              className={clsx(styles.btn, styles.btnSuspend)}
              onClick={() => setShowSuspendModal(true)}
            >
              <Ban size={16} />
              <span>{t('admin.suppliers.actions.suspend')}</span>
            </button>
          )}
          {supplier.status === 'suspended' && (
            <button
              className={clsx(styles.btn, styles.btnApprove)}
              onClick={() => onUnsuspend?.(supplier)}
            >
              <CheckCircle size={16} />
              <span>{t('admin.suppliers.actions.unsuspend')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <>
          <div className={styles.modalOverlay} onClick={() => setShowRejectModal(false)} />
          <div className={styles.modal}>
            <h3>{t('admin.suppliers.reject.title')}</h3>
            <p>{t('admin.suppliers.reject.message')}</p>
            <textarea
              className={styles.textarea}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('admin.suppliers.reject.placeholder')}
              rows={4}
            />
            <div className={styles.modalActions}>
              <button
                className={clsx(styles.btn, styles.btnSecondary)}
                onClick={() => setShowRejectModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className={clsx(styles.btn, styles.btnReject)}
                onClick={handleReject}
                disabled={!rejectReason.trim()}
              >
                {t('admin.suppliers.actions.reject')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <>
          <div className={styles.modalOverlay} onClick={() => setShowSuspendModal(false)} />
          <div className={styles.modal}>
            <h3>{t('admin.suppliers.suspend.title')}</h3>
            <p>{t('admin.suppliers.suspend.message')}</p>
            <textarea
              className={styles.textarea}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder={t('admin.suppliers.suspend.placeholder')}
              rows={4}
            />
            <div className={styles.modalActions}>
              <button
                className={clsx(styles.btn, styles.btnSecondary)}
                onClick={() => setShowSuspendModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className={clsx(styles.btn, styles.btnSuspend)}
                onClick={handleSuspend}
                disabled={!suspendReason.trim()}
              >
                {t('admin.suppliers.actions.suspend')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default SupplierDetail;
