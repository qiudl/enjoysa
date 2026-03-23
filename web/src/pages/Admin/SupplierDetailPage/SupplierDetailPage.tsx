import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit2 } from 'lucide-react';
import { adminService, type ApiSupplierDetail } from '../../../services/adminService';
import { OverviewTab, ProductsTab, OrdersTab, FinanceTab, EditSupplierModal } from '../../../components/Admin/SupplierDetailTabs';
import styles from './SupplierDetailPage.module.css';

type TabKey = 'overview' | 'products' | 'orders' | 'finance';

const SupplierDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ApiSupplierDetail | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [editOpen, setEditOpen] = useState(false);

  const supplierId = Number(id);

  const loadDetail = async () => {
    if (!supplierId) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminService.getSupplierDetail(supplierId);
      setDetail(data);
    } catch {
      setError(t('admin.suppliers.detail.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [supplierId]);

  const handleApprove = async () => {
    try {
      await adminService.approveSupplier(supplierId);
      loadDetail();
    } catch {
      // silent
    }
  };

  const handleReject = async () => {
    const reason = window.prompt(t('admin.suppliers.detail.rejectReasonPrompt'));
    if (!reason) return;
    try {
      await adminService.rejectSupplier(supplierId, reason);
      loadDetail();
    } catch {
      // silent
    }
  };

  const handleSuspend = async () => {
    try {
      await adminService.suspendSupplier(supplierId);
      loadDetail();
    } catch {
      // silent
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: t('admin.suppliers.detail.tabs.overview') },
    { key: 'products', label: t('admin.suppliers.detail.tabs.products') },
    { key: 'orders', label: t('admin.suppliers.detail.tabs.orders') },
    { key: 'finance', label: t('admin.suppliers.detail.tabs.finance') },
  ];

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>{t('common.loading')}</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/suppliers')}>
          <ArrowLeft size={16} />
          {t('admin.suppliers.detail.back')}
        </button>
        <div className={styles.empty}>{error || t('admin.suppliers.detail.notFound')}</div>
      </div>
    );
  }

  const { supplier, stats } = detail;
  const status = supplier.status;

  return (
    <div className={styles.page}>
      {/* Back button */}
      <button className={styles.backBtn} onClick={() => navigate('/admin/suppliers')}>
        <ArrowLeft size={16} />
        {t('admin.suppliers.detail.back')}
      </button>

      {/* Header card */}
      <div className={styles.header}>
        <div className={styles.supplierInfo}>
          {supplier.logo ? (
            <img src={supplier.logo} alt="" className={styles.logo} />
          ) : (
            <div className={styles.logoPlaceholder}>
              {supplier.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className={styles.nameGroup}>
            <h1>
              {supplier.name}
              {supplier.tier && (
                <span className={`${styles.tierBadge} ${styles[supplier.tier]}`}>
                  {supplier.tier}
                </span>
              )}
            </h1>
            <div className={styles.meta}>
              <span className={`${styles.statusBadge} ${styles[status]}`}>
                {t(`admin.suppliers.status.${status}`)}
              </span>
              <span>{supplier.type}</span>
              <span>{supplier.email}</span>
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.editBtn} onClick={() => setEditOpen(true)}>
            <Edit2 size={16} />
            {t('admin.suppliers.detail.edit')}
          </button>
          {status === 'pending' && (
            <>
              <button className={styles.successBtn} onClick={handleApprove}>
                {t('admin.suppliers.actions.approve')}
              </button>
              <button className={styles.dangerBtn} onClick={handleReject}>
                {t('admin.suppliers.actions.reject')}
              </button>
            </>
          )}
          {status === 'approved' && (
            <button className={styles.dangerBtn} onClick={handleSuspend}>
              {t('admin.suppliers.actions.suspend')}
            </button>
          )}
          {status === 'suspended' && (
            <button className={styles.successBtn} onClick={handleApprove}>
              {t('admin.suppliers.actions.unsuspend')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab supplierId={supplierId} stats={stats} />
      )}
      {activeTab === 'products' && (
        <ProductsTab supplierId={supplierId} />
      )}
      {activeTab === 'orders' && (
        <OrdersTab supplierId={supplierId} />
      )}
      {activeTab === 'finance' && (
        <FinanceTab supplierId={supplierId} />
      )}

      {/* Edit Modal */}
      <EditSupplierModal
        supplierId={supplierId}
        supplier={supplier}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          loadDetail();
        }}
      />
    </div>
  );
};

export default SupplierDetailPage;
