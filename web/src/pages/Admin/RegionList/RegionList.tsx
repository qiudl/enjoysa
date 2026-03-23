import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, MapPin } from 'lucide-react';
import { Modal, ConfirmModal } from '../../../components/Common';
import { adminService, type ApiRegionAdmin } from '../../../services/adminService';
import styles from './RegionList.module.css';

interface RegionFormData {
  name_zh: string;
  name_en: string;
  slug: string;
  desc_zh: string;
  desc_en: string;
  tagline_zh: string;
  tagline_en: string;
  image: string;
  sort_order: number;
}

const emptyForm: RegionFormData = {
  name_zh: '',
  name_en: '',
  slug: '',
  desc_zh: '',
  desc_en: '',
  tagline_zh: '',
  tagline_en: '',
  image: '',
  sort_order: 0,
};

export const RegionList: React.FC = () => {
  const { t } = useTranslation();

  const [regions, setRegions] = useState<ApiRegionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<ApiRegionAdmin | null>(null);
  const [formData, setFormData] = useState<RegionFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ApiRegionAdmin | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await adminService.listRegions();
      setRegions(result || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingRegion(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const handleEdit = (region: ApiRegionAdmin) => {
    setEditingRegion(region);
    setFormData({
      name_zh: region.name_zh,
      name_en: region.name_en,
      slug: region.slug,
      desc_zh: region.desc_zh,
      desc_en: region.desc_en,
      tagline_zh: region.tagline_zh,
      tagline_en: region.tagline_en,
      image: region.image,
      sort_order: region.sort_order,
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    setSaving(true);
    try {
      if (editingRegion) {
        const updated = await adminService.updateRegion(editingRegion.id, formData);
        setRegions((prev) => prev.map((r) => (r.id === editingRegion.id ? updated : r)));
      } else {
        const created = await adminService.createRegion(formData as Omit<ApiRegionAdmin, 'id' | 'created_at' | 'updated_at' | 'attraction_count'>);
        setRegions((prev) => [...prev, created]);
      }
      setFormOpen(false);
      setEditingRegion(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await adminService.deleteRegion(deleteConfirm.id);
      setRegions((prev) => prev.filter((r) => r.id !== deleteConfirm.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
    setDeleteConfirm(null);
  };

  const updateField = (field: keyof RegionFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>{t('admin.regions.title', 'Region Management')}</h1>
          <p className={styles.pageDescription}>
            {t('admin.regions.description', 'Manage destination regions and areas')}
          </p>
        </div>
        <button className={styles.addBtn} onClick={handleAdd}>
          <Plus size={18} />
          {t('admin.regions.create', 'Add Region')}
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
        ) : regions.length === 0 ? (
          <div className={styles.empty}>{t('admin.regions.empty', 'No regions found')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.regions.image', 'Image')}</th>
                <th>{t('admin.regions.nameZh', 'Name (ZH)')}</th>
                <th>{t('admin.regions.slug', 'Slug')}</th>
                <th>{t('admin.regions.attractionCount', 'Attractions')}</th>
                <th>{t('admin.regions.sortOrder', 'Sort')}</th>
                <th>{t('admin.regions.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <tr key={region.id}>
                  <td>
                    {region.image ? (
                      <img src={region.image} alt={region.name_zh} className={styles.thumbnail} />
                    ) : (
                      <div className={styles.thumbnailPlaceholder}>
                        <MapPin size={16} />
                      </div>
                    )}
                  </td>
                  <td>{region.name_zh}</td>
                  <td>
                    <span className={styles.slug}>{region.slug}</span>
                  </td>
                  <td>
                    <span className={styles.countBadge}>{region.attraction_count}</span>
                  </td>
                  <td>{region.sort_order}</td>
                  <td>
                    <button className={styles.actionBtn} onClick={() => handleEdit(region)}>
                      {t('common.edit', 'Edit')}
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => setDeleteConfirm(region)}
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
        title={editingRegion
          ? t('admin.regions.edit', '编辑地区')
          : t('admin.regions.create', '添加地区')}
        titleEn={editingRegion ? 'Edit Region' : 'Add Region'}
        size="lg"
        confirmLoading={saving}
        onClose={() => { setFormOpen(false); setEditingRegion(null); }}
        onOk={handleFormSubmit}
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>{t('admin.regions.field.nameZh', 'Name (ZH)')}</label>
              <input
                type="text"
                value={formData.name_zh}
                onChange={(e) => updateField('name_zh', e.target.value)}
                placeholder={t('admin.regions.field.nameZhPlaceholder', 'Chinese name')}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.regions.field.nameEn', 'Name (EN)')}</label>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) => updateField('name_en', e.target.value)}
                placeholder={t('admin.regions.field.nameEnPlaceholder', 'English name')}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.regions.field.slug', 'Slug')}</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                placeholder="e.g. adelaide-hills"
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.regions.field.sortOrder', 'Sort Order')}</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => updateField('sort_order', Number(e.target.value))}
                min={0}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.regions.field.taglineZh', 'Tagline (ZH)')}</label>
              <input
                type="text"
                value={formData.tagline_zh}
                onChange={(e) => updateField('tagline_zh', e.target.value)}
                placeholder={t('admin.regions.field.taglineZhPlaceholder', 'Chinese tagline')}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.regions.field.taglineEn', 'Tagline (EN)')}</label>
              <input
                type="text"
                value={formData.tagline_en}
                onChange={(e) => updateField('tagline_en', e.target.value)}
                placeholder={t('admin.regions.field.taglineEnPlaceholder', 'English tagline')}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.regions.field.descZh', 'Description (ZH)')}</label>
              <textarea
                value={formData.desc_zh}
                onChange={(e) => updateField('desc_zh', e.target.value)}
                placeholder={t('admin.regions.field.descZhPlaceholder', 'Chinese description')}
                rows={3}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.regions.field.descEn', 'Description (EN)')}</label>
              <textarea
                value={formData.desc_en}
                onChange={(e) => updateField('desc_en', e.target.value)}
                placeholder={t('admin.regions.field.descEnPlaceholder', 'English description')}
                rows={3}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.regions.field.imageUrl', 'Image URL')}</label>
              <input
                type="text"
                value={formData.image}
                onChange={(e) => updateField('image', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteConfirm}
        type="danger"
        title={t('admin.regions.deleteTitle', '删除地区')}
        titleEn="Delete Region"
        message={t('admin.regions.deleteConfirm', `确定要删除地区 "${deleteConfirm?.name_zh}" 吗？此操作不可撤销。`)}
        messageEn={`Are you sure you want to delete region "${deleteConfirm?.name_zh}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

export default RegionList;
