// REQ-20260510-0002 · Phase 1 · 1D — Food admin list

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw } from 'lucide-react';
import { Modal, ConfirmModal } from '../../../components/Common';
import {
  tourismKnowledgeService,
  type ApiFood,
  type FoodFilter,
  type FoodPayload,
} from '../../../services/tourismKnowledgeService';
import {
  parseTagsInput,
  tagsToInput,
  parseOptionalNumber,
  numberOrEmpty,
} from './helpers';
import styles from './TourismKnowledge.module.css';

interface FormState {
  name_zh: string;
  name_en: string;
  council: string;
  cuisine: string;
  price_range_min: string;
  price_range_max: string;
  signature_dishes: string;
  address: string;
  source: string;
  source_ref: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  name_zh: '',
  name_en: '',
  council: '',
  cuisine: '',
  price_range_min: '',
  price_range_max: '',
  signature_dishes: '',
  address: '',
  source: '',
  source_ref: '',
  is_active: true,
};

export const FoodList: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ApiFood[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FoodFilter>({ page: 1, page_size: 20 });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiFood | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ApiFood | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await tourismKnowledgeService.listFood(filter);
      setRows(r.items || []);
      setTotal(r.total || 0);
    } catch {
      /* leave previous rows */
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (row: ApiFood) => {
    setEditing(row);
    setFormData({
      name_zh: row.name_zh,
      name_en: row.name_en ?? '',
      council: row.council ?? '',
      cuisine: row.cuisine ?? '',
      price_range_min: numberOrEmpty(row.price_range_min),
      price_range_max: numberOrEmpty(row.price_range_max),
      signature_dishes: tagsToInput(row.signature_dishes),
      address: row.address ?? '',
      source: row.source ?? '',
      source_ref: row.source_ref ?? '',
      is_active: row.is_active,
    });
    setFormOpen(true);
  };

  const submit = async () => {
    if (!formData.name_zh.trim()) {
      alert(t('admin.tourism.errors.nameZhRequired', '中文名为必填'));
      return;
    }
    setSaving(true);
    try {
      const payload: FoodPayload = {
        name_zh: formData.name_zh.trim(),
        name_en: formData.name_en.trim() || undefined,
        council: formData.council.trim() || undefined,
        cuisine: formData.cuisine.trim() || undefined,
        price_range_min: parseOptionalNumber(formData.price_range_min),
        price_range_max: parseOptionalNumber(formData.price_range_max),
        signature_dishes: parseTagsInput(formData.signature_dishes),
        address: formData.address.trim() || undefined,
        source: formData.source.trim() || undefined,
        source_ref: formData.source_ref.trim() || undefined,
        is_active: formData.is_active,
      };
      if (editing) {
        await tourismKnowledgeService.updateFood(editing.id, payload);
      } else {
        await tourismKnowledgeService.createFood(payload);
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await tourismKnowledgeService.deleteFood(deleteConfirm.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteConfirm.id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Council</span>
          <input
            className={styles.filterInput}
            value={filter.council ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, council: e.target.value, page: 1 }))}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('admin.tourism.col.cuisine', '菜系')}</span>
          <input
            className={styles.filterInput}
            value={filter.cuisine ?? ''}
            placeholder="seafood / italian / chinese"
            onChange={(e) => setFilter((f) => ({ ...f, cuisine: e.target.value, page: 1 }))}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('admin.tourism.filter.keywords', 'Keywords')}</span>
          <input
            className={styles.filterInput}
            value={filter.keywords ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, keywords: e.target.value, page: 1 }))}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('admin.tourism.filter.status', 'Status')}</span>
          <select
            className={styles.filterSelect}
            value={filter.is_active === undefined ? '' : String(filter.is_active)}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                is_active: e.target.value === '' ? undefined : e.target.value === 'true',
                page: 1,
              }))
            }
          >
            <option value="">{t('admin.tourism.filter.all', '全部')}</option>
            <option value="true">{t('admin.tourism.filter.active', '已启用')}</option>
            <option value="false">{t('admin.tourism.filter.inactive', '草稿')}</option>
          </select>
        </div>
        <div className={styles.filterActions}>
          <button className={styles.iconBtn} onClick={load} title={t('common.refresh', 'Refresh')}>
            <RefreshCw size={16} />
          </button>
          <button className={styles.addBtn} onClick={openCreate}>
            <Plus size={16} />
            {t('admin.tourism.food.add', '新增餐厅')}
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>{t('admin.tourism.empty', '暂无数据')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colNarrow}>ID</th>
                <th>{t('admin.tourism.col.nameZh', '中文名')}</th>
                <th>Council</th>
                <th>{t('admin.tourism.col.cuisine', 'Cuisine')}</th>
                <th>{t('admin.tourism.col.signatureDishes', '招牌菜')}</th>
                <th className={styles.colNarrow}>{t('admin.tourism.col.priceRange', '价格区间')}</th>
                <th className={styles.colNarrow}>{t('admin.tourism.col.status', '状态')}</th>
                <th className={styles.colNarrow}>{t('admin.tourism.col.actions', '操作')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={styles.colNarrow}>{r.id}</td>
                  <td>{r.name_zh}</td>
                  <td>{r.council || '—'}</td>
                  <td>{r.cuisine || '—'}</td>
                  <td>
                    {r.signature_dishes.slice(0, 3).map((d) => (
                      <span key={d} className={styles.tagPill}>
                        {d}
                      </span>
                    ))}
                    {r.signature_dishes.length > 3 && (
                      <span className={styles.tagPill}>+{r.signature_dishes.length - 3}</span>
                    )}
                  </td>
                  <td className={styles.colNarrow}>
                    {r.price_range_min !== undefined || r.price_range_max !== undefined
                      ? `${r.price_range_min ?? '?'} – ${r.price_range_max ?? '?'}`
                      : '—'}
                  </td>
                  <td className={styles.colNarrow}>
                    <span
                      className={`${styles.statusBadge} ${
                        r.is_active ? styles.statusActive : styles.statusInactive
                      }`}
                    >
                      {r.is_active
                        ? t('admin.tourism.status.active', '已启用')
                        : t('admin.tourism.status.inactive', '草稿')}
                    </span>
                  </td>
                  <td className={styles.colNarrow}>
                    <button className={styles.actionBtn} onClick={() => openEdit(r)}>
                      {t('common.edit', 'Edit')}
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => setDeleteConfirm(r)}
                    >
                      {t('common.delete', 'Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && rows.length > 0 && (
          <div className={styles.paginationFooter}>
            <span>{t('admin.tourism.pagination.summary', '共 {{total}} 条', { total })}</span>
            <div className={styles.paginationButtons}>
              <button
                className={styles.pageBtn}
                disabled={(filter.page ?? 1) <= 1}
                onClick={() => setFilter((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}
              >
                {t('common.prev', '上一页')}
              </button>
              <button
                className={styles.pageBtn}
                disabled={(filter.page ?? 1) * (filter.page_size ?? 20) >= total}
                onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              >
                {t('common.next', '下一页')}
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        title={
          editing
            ? t('admin.tourism.food.editTitle', '编辑餐厅')
            : t('admin.tourism.food.createTitle', '新增餐厅')
        }
        size="lg"
        confirmLoading={saving}
        onClose={() => setFormOpen(false)}
        onOk={submit}
        onCancel={() => setFormOpen(false)}
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>{t('admin.tourism.col.nameZh', '中文名')} *</label>
              <input
                value={formData.name_zh}
                onChange={(e) => setFormData((p) => ({ ...p, name_zh: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.tourism.col.nameEn', '英文名')}</label>
              <input
                value={formData.name_en}
                onChange={(e) => setFormData((p) => ({ ...p, name_en: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Council</label>
              <input
                value={formData.council}
                onChange={(e) => setFormData((p) => ({ ...p, council: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.tourism.col.cuisine', '菜系')}</label>
              <input
                value={formData.cuisine}
                placeholder="seafood / italian / chinese"
                onChange={(e) => setFormData((p) => ({ ...p, cuisine: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.tourism.col.priceMin', '价格下限 (AUD)')}</label>
              <input
                type="number"
                step="0.01"
                value={formData.price_range_min}
                onChange={(e) => setFormData((p) => ({ ...p, price_range_min: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.tourism.col.priceMax', '价格上限 (AUD)')}</label>
              <input
                type="number"
                step="0.01"
                value={formData.price_range_max}
                onChange={(e) => setFormData((p) => ({ ...p, price_range_max: e.target.value }))}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>
                {t('admin.tourism.col.signatureDishes', '招牌菜')}{' '}
                <span className={styles.helperText}>{t('admin.tourism.tagsHelper', '逗号分隔')}</span>
              </label>
              <input
                value={formData.signature_dishes}
                placeholder="生蚝, 龙虾汤, 西冷牛排"
                onChange={(e) => setFormData((p) => ({ ...p, signature_dishes: e.target.value }))}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.tourism.col.address', '地址')}</label>
              <input
                value={formData.address}
                onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Source</label>
              <input
                value={formData.source}
                placeholder="admin_manual"
                onChange={(e) => setFormData((p) => ({ ...p, source: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Source Ref</label>
              <input
                value={formData.source_ref}
                onChange={(e) => setFormData((p) => ({ ...p, source_ref: e.target.value }))}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
                />
                {t('admin.tourism.form.isActive', '启用（AI Agent 可见）')}
              </label>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteConfirm}
        type="danger"
        title={t('admin.tourism.deleteTitle', '确认删除')}
        message={
          deleteConfirm
            ? t('admin.tourism.deleteMessage', '确定要删除「{{name}}」吗？', {
                name: deleteConfirm.name_zh,
              })
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
};

export default FoodList;
