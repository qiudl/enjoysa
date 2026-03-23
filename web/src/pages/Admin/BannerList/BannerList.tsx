import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Image } from 'lucide-react';
import { Modal, ConfirmModal } from '../../../components/Common';
import { adminService, type ApiBanner } from '../../../services/adminService';
import styles from './BannerList.module.css';

interface BannerFormData {
  title_zh: string;
  title_en: string;
  subtitle_zh: string;
  subtitle_en: string;
  image: string;
  link_url: string;
  sort_order: number;
  status: string;
}

const emptyForm: BannerFormData = {
  title_zh: '',
  title_en: '',
  subtitle_zh: '',
  subtitle_en: '',
  image: '',
  link_url: '',
  sort_order: 0,
  status: 'active',
};

export const BannerList: React.FC = () => {
  const { t } = useTranslation();

  const [banners, setBanners] = useState<ApiBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<ApiBanner | null>(null);
  const [formData, setFormData] = useState<BannerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ApiBanner | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await adminService.listBanners();
      setBanners(result || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingBanner(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const handleEdit = (banner: ApiBanner) => {
    setEditingBanner(banner);
    setFormData({
      title_zh: banner.title_zh,
      title_en: banner.title_en,
      subtitle_zh: banner.subtitle_zh,
      subtitle_en: banner.subtitle_en,
      image: banner.image,
      link_url: banner.link_url,
      sort_order: banner.sort_order,
      status: banner.status,
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    setSaving(true);
    try {
      if (editingBanner) {
        const updated = await adminService.updateBanner(editingBanner.id, formData);
        setBanners((prev) => prev.map((b) => (b.id === editingBanner.id ? updated : b)));
      } else {
        const created = await adminService.createBanner(formData as Omit<ApiBanner, 'id' | 'created_at' | 'updated_at'>);
        setBanners((prev) => [...prev, created]);
      }
      setFormOpen(false);
      setEditingBanner(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    }
    setSaving(false);
  };

  const handleToggleStatus = async (banner: ApiBanner) => {
    const newStatus = banner.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await adminService.updateBanner(banner.id, { status: newStatus });
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? updated : b)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await adminService.deleteBanner(deleteConfirm.id);
      setBanners((prev) => prev.filter((b) => b.id !== deleteConfirm.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
    setDeleteConfirm(null);
  };

  const updateField = (field: keyof BannerFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>{t('admin.banners.title', 'Banner Management')}</h1>
          <p className={styles.pageDescription}>
            {t('admin.banners.description', 'Manage homepage banners and promotional slides')}
          </p>
        </div>
        <button className={styles.addBtn} onClick={handleAdd}>
          <Plus size={18} />
          {t('admin.banners.create', 'Add Banner')}
        </button>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.iconBtn} onClick={loadData} title={t('common.refresh', 'Refresh')}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : banners.length === 0 ? (
          <div className={styles.empty}>{t('admin.banners.empty', 'No banners found')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.banners.image', 'Image')}</th>
                <th>{t('admin.banners.titleZh', 'Title (ZH)')}</th>
                <th>{t('admin.banners.linkUrl', 'Link URL')}</th>
                <th>{t('admin.banners.sortOrder', 'Sort')}</th>
                <th>{t('admin.banners.status', 'Status')}</th>
                <th>{t('admin.banners.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner.id}>
                  <td>
                    {banner.image ? (
                      <img src={banner.image} alt={banner.title_zh} className={styles.thumbnail} />
                    ) : (
                      <div className={styles.thumbnailPlaceholder}>
                        <Image size={16} />
                      </div>
                    )}
                  </td>
                  <td>{banner.title_zh}</td>
                  <td>
                    {banner.link_url ? (
                      <a href={banner.link_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontSize: '0.875rem' }}>
                        {banner.link_url.length > 40 ? banner.link_url.slice(0, 40) + '...' : banner.link_url}
                      </a>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    )}
                  </td>
                  <td>{banner.sort_order}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${banner.status === 'active' ? styles.badgeActive : styles.badgeInactive}`}
                      onClick={() => handleToggleStatus(banner)}
                      title={t('admin.banners.toggleStatus', 'Click to toggle status')}
                    >
                      {banner.status === 'active'
                        ? t('admin.banners.active', 'Active')
                        : t('admin.banners.inactive', 'Inactive')}
                    </span>
                  </td>
                  <td>
                    <button className={styles.actionBtn} onClick={() => handleEdit(banner)}>
                      {t('common.edit', 'Edit')}
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => setDeleteConfirm(banner)}
                    >
                      {t('common.delete', 'Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={formOpen}
        title={editingBanner
          ? t('admin.banners.edit', '编辑 Banner')
          : t('admin.banners.create', '添加 Banner')}
        titleEn={editingBanner ? 'Edit Banner' : 'Add Banner'}
        size="lg"
        confirmLoading={saving}
        onClose={() => { setFormOpen(false); setEditingBanner(null); }}
        onOk={handleFormSubmit}
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>{t('admin.banners.field.titleZh', 'Title (ZH)')}</label>
              <input
                type="text"
                value={formData.title_zh}
                onChange={(e) => updateField('title_zh', e.target.value)}
                placeholder={t('admin.banners.field.titleZhPlaceholder', 'Chinese title')}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.banners.field.titleEn', 'Title (EN)')}</label>
              <input
                type="text"
                value={formData.title_en}
                onChange={(e) => updateField('title_en', e.target.value)}
                placeholder={t('admin.banners.field.titleEnPlaceholder', 'English title')}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.banners.field.subtitleZh', 'Subtitle (ZH)')}</label>
              <input
                type="text"
                value={formData.subtitle_zh}
                onChange={(e) => updateField('subtitle_zh', e.target.value)}
                placeholder={t('admin.banners.field.subtitleZhPlaceholder', 'Chinese subtitle')}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.banners.field.subtitleEn', 'Subtitle (EN)')}</label>
              <input
                type="text"
                value={formData.subtitle_en}
                onChange={(e) => updateField('subtitle_en', e.target.value)}
                placeholder={t('admin.banners.field.subtitleEnPlaceholder', 'English subtitle')}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.banners.field.imageUrl', 'Image URL')}</label>
              <input
                type="text"
                value={formData.image}
                onChange={(e) => updateField('image', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.banners.field.linkUrl', 'Link URL')}</label>
              <input
                type="text"
                value={formData.link_url}
                onChange={(e) => updateField('link_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.banners.field.sortOrder', 'Sort Order')}</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => updateField('sort_order', Number(e.target.value))}
                min={0}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.banners.field.status', 'Status')}</label>
              <select
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value)}
              >
                <option value="active">{t('admin.banners.active', 'Active')}</option>
                <option value="inactive">{t('admin.banners.inactive', 'Inactive')}</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteConfirm}
        type="danger"
        title={t('admin.banners.deleteTitle', '删除 Banner')}
        titleEn="Delete Banner"
        message={t('admin.banners.deleteConfirm', `确定要删除 Banner "${deleteConfirm?.title_zh}" 吗？此操作不可撤销。`)}
        messageEn={`Are you sure you want to delete banner "${deleteConfirm?.title_zh}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

export default BannerList;
