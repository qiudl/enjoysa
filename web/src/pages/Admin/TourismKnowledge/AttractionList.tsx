// REQ-20260510-0002 · Phase 1 · 1D — Attractions admin list

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw } from 'lucide-react';
import { Modal, ConfirmModal } from '../../../components/Common';
import {
  tourismKnowledgeService,
  type ApiAttraction,
  type AttractionFilter,
  type AttractionPayload,
} from '../../../services/tourismKnowledgeService';
import {
  parseTagsInput,
  tagsToInput,
  parseOptionalNumber,
  parseOptionalInt,
  numberOrEmpty,
} from './helpers';
import styles from './TourismKnowledge.module.css';

interface FormState {
  name_zh: string;
  name_en: string;
  council: string;
  category: string;
  tags: string;
  best_seasons: string;
  price_range_min: string;
  price_range_max: string;
  typical_duration_minutes: string;
  description: string;
  source: string;
  source_ref: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  name_zh: '',
  name_en: '',
  council: '',
  category: '',
  tags: '',
  best_seasons: '',
  price_range_min: '',
  price_range_max: '',
  typical_duration_minutes: '',
  description: '',
  source: '',
  source_ref: '',
  is_active: true,
};

export const AttractionList: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ApiAttraction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AttractionFilter>({ page: 1, page_size: 20 });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiAttraction | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ApiAttraction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await tourismKnowledgeService.listAttractions(filter);
      setRows(r.items || []);
      setTotal(r.total || 0);
    } catch {
      /* leave previous rows; admin can hit refresh */
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

  const openEdit = (row: ApiAttraction) => {
    setEditing(row);
    setFormData({
      name_zh: row.name_zh,
      name_en: row.name_en ?? '',
      council: row.council ?? '',
      category: row.category ?? '',
      tags: tagsToInput(row.tags),
      best_seasons: tagsToInput(row.best_seasons),
      price_range_min: numberOrEmpty(row.price_range_min),
      price_range_max: numberOrEmpty(row.price_range_max),
      typical_duration_minutes: numberOrEmpty(row.typical_duration_minutes),
      description: row.description ?? '',
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
      const payload: AttractionPayload = {
        name_zh: formData.name_zh.trim(),
        name_en: formData.name_en.trim() || undefined,
        council: formData.council.trim() || undefined,
        category: formData.category.trim() || undefined,
        tags: parseTagsInput(formData.tags),
        best_seasons: parseTagsInput(formData.best_seasons),
        price_range_min: parseOptionalNumber(formData.price_range_min),
        price_range_max: parseOptionalNumber(formData.price_range_max),
        typical_duration_minutes: parseOptionalInt(formData.typical_duration_minutes),
        description: formData.description.trim() || undefined,
        source: formData.source.trim() || undefined,
        source_ref: formData.source_ref.trim() || undefined,
        is_active: formData.is_active,
      };
      if (editing) {
        await tourismKnowledgeService.updateAttraction(editing.id, payload);
      } else {
        await tourismKnowledgeService.createAttraction(payload);
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
      await tourismKnowledgeService.deleteAttraction(deleteConfirm.id);
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
          <span className={styles.filterLabel}>{t('admin.tourism.filter.council', 'Council')}</span>
          <input
            className={styles.filterInput}
            placeholder="Adelaide Hills"
            value={filter.council ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, council: e.target.value, page: 1 }))}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('admin.tourism.filter.category', 'Category')}</span>
          <input
            className={styles.filterInput}
            placeholder="wildlife"
            value={filter.category ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value, page: 1 }))}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('admin.tourism.filter.keywords', 'Keywords')}</span>
          <input
            className={styles.filterInput}
            placeholder={t('admin.tourism.filter.keywordsPlaceholder', '名称 / 描述')}
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
            {t('admin.tourism.attractions.add', '新增景点')}
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
                <th>{t('admin.tourism.col.nameEn', '英文名')}</th>
                <th>{t('admin.tourism.col.council', 'Council')}</th>
                <th>{t('admin.tourism.col.category', 'Category')}</th>
                <th>{t('admin.tourism.col.tags', 'Tags')}</th>
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
                  <td>{r.name_en || '—'}</td>
                  <td>{r.council || '—'}</td>
                  <td>{r.category || '—'}</td>
                  <td>
                    {r.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className={styles.tagPill}>
                        {tag}
                      </span>
                    ))}
                    {r.tags.length > 3 && <span className={styles.tagPill}>+{r.tags.length - 3}</span>}
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
            <span>
              {t('admin.tourism.pagination.summary', '共 {{total}} 条', { total })}
            </span>
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
            ? t('admin.tourism.attractions.editTitle', '编辑景点')
            : t('admin.tourism.attractions.createTitle', '新增景点')
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
              <label>Category</label>
              <input
                value={formData.category}
                placeholder="nature / urban / wildlife / wine ..."
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
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
            <div className={styles.formGroup}>
              <label>{t('admin.tourism.col.duration', '典型时长（分钟）')}</label>
              <input
                type="number"
                value={formData.typical_duration_minutes}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, typical_duration_minutes: e.target.value }))
                }
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
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>
                {t('admin.tourism.col.tags', '标签')}{' '}
                <span className={styles.helperText}>{t('admin.tourism.tagsHelper', '逗号分隔')}</span>
              </label>
              <input
                value={formData.tags}
                placeholder="family, easy, photo-spot"
                onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value }))}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>
                {t('admin.tourism.col.bestSeasons', '最佳季节')}{' '}
                <span className={styles.helperText}>year_round / spring / summer / autumn / winter</span>
              </label>
              <input
                value={formData.best_seasons}
                placeholder="spring, autumn"
                onChange={(e) => setFormData((p) => ({ ...p, best_seasons: e.target.value }))}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.tourism.col.description', '描述')}</label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Source Ref</label>
              <input
                value={formData.source_ref}
                placeholder="https://... 或 product_id"
                onChange={(e) => setFormData((p) => ({ ...p, source_ref: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>&nbsp;</label>
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

export default AttractionList;
