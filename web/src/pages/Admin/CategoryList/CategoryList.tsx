import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Tag } from 'lucide-react';
import { Modal, ConfirmModal } from '../../../components/Common';
import { adminService, type ApiCategoryAdmin } from '../../../services/adminService';
import styles from './CategoryList.module.css';

interface CategoryFormData {
  name_zh: string;
  name_en: string;
  slug: string;
  icon: string;
  sort_order: number;
}

const emptyForm: CategoryFormData = {
  name_zh: '',
  name_en: '',
  slug: '',
  icon: '',
  sort_order: 0,
};

export const CategoryList: React.FC = () => {
  const { t } = useTranslation();

  const [categories, setCategories] = useState<ApiCategoryAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ApiCategoryAdmin | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ApiCategoryAdmin | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await adminService.listCategories();
      setCategories(result || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingCategory(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const handleEdit = (category: ApiCategoryAdmin) => {
    setEditingCategory(category);
    setFormData({
      name_zh: category.name_zh,
      name_en: category.name_en,
      slug: category.slug,
      icon: category.icon,
      sort_order: category.sort_order,
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    setSaving(true);
    try {
      if (editingCategory) {
        const updated = await adminService.updateCategory(editingCategory.id, formData);
        setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? updated : c)));
      } else {
        const created = await adminService.createCategory(formData as Omit<ApiCategoryAdmin, 'id' | 'created_at' | 'updated_at' | 'product_count'>);
        setCategories((prev) => [...prev, created]);
      }
      setFormOpen(false);
      setEditingCategory(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await adminService.deleteCategory(deleteConfirm.id);
      setCategories((prev) => prev.filter((c) => c.id !== deleteConfirm.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
    setDeleteConfirm(null);
  };

  const updateField = (field: keyof CategoryFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>{t('admin.categories.title', 'Category Management')}</h1>
          <p className={styles.pageDescription}>
            {t('admin.categories.description', 'Manage product categories and classifications')}
          </p>
        </div>
        <button className={styles.addBtn} onClick={handleAdd}>
          <Plus size={18} />
          {t('admin.categories.create', 'Add Category')}
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
        ) : categories.length === 0 ? (
          <div className={styles.empty}>{t('admin.categories.empty', 'No categories found')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.categories.icon', 'Icon')}</th>
                <th>{t('admin.categories.nameZh', 'Name (ZH)')}</th>
                <th>{t('admin.categories.slug', 'Slug')}</th>
                <th>{t('admin.categories.productCount', 'Products')}</th>
                <th>{t('admin.categories.sortOrder', 'Sort')}</th>
                <th>{t('admin.categories.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    {category.icon ? (
                      <span className={styles.iconCell}>{category.icon}</span>
                    ) : (
                      <div className={styles.iconPlaceholder}>
                        <Tag size={14} />
                      </div>
                    )}
                  </td>
                  <td>{category.name_zh}</td>
                  <td>
                    <span className={styles.slug}>{category.slug}</span>
                  </td>
                  <td>
                    <span className={styles.countBadge}>{category.product_count ?? 0}</span>
                  </td>
                  <td>{category.sort_order}</td>
                  <td>
                    <button className={styles.actionBtn} onClick={() => handleEdit(category)}>
                      {t('common.edit', 'Edit')}
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => setDeleteConfirm(category)}
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
        title={editingCategory
          ? t('admin.categories.edit', '编辑分类')
          : t('admin.categories.create', '添加分类')}
        titleEn={editingCategory ? 'Edit Category' : 'Add Category'}
        size="md"
        confirmLoading={saving}
        onClose={() => { setFormOpen(false); setEditingCategory(null); }}
        onOk={handleFormSubmit}
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>{t('admin.categories.field.nameZh', 'Name (ZH)')}</label>
              <input
                type="text"
                value={formData.name_zh}
                onChange={(e) => updateField('name_zh', e.target.value)}
                placeholder={t('admin.categories.field.nameZhPlaceholder', 'Chinese name')}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.categories.field.nameEn', 'Name (EN)')}</label>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) => updateField('name_en', e.target.value)}
                placeholder={t('admin.categories.field.nameEnPlaceholder', 'English name')}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.categories.field.slug', 'Slug')}</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                placeholder="e.g. wine-tours"
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.categories.field.icon', 'Icon')}</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => updateField('icon', e.target.value)}
                placeholder={t('admin.categories.field.iconPlaceholder', 'Emoji or icon class')}
              />
              <span className={styles.formHint}>
                {t('admin.categories.field.iconHint', 'Enter an emoji or icon identifier')}
              </span>
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.categories.field.sortOrder', 'Sort Order')}</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => updateField('sort_order', Number(e.target.value))}
                min={0}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteConfirm}
        type="danger"
        title={t('admin.categories.deleteTitle', '删除分类')}
        titleEn="Delete Category"
        message={t('admin.categories.deleteConfirm', `确定要删除分类 "${deleteConfirm?.name_zh}" 吗？此操作不可撤销。`)}
        messageEn={`Are you sure you want to delete category "${deleteConfirm?.name_zh}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

export default CategoryList;
