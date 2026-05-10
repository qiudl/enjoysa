// REQ-20260510-0002 · Phase 1 · 1D — Pricing benchmarks admin list

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw } from 'lucide-react';
import { Modal, ConfirmModal } from '../../../components/Common';
import {
  tourismKnowledgeService,
  type ApiPricingBenchmark,
  type DurationBucket,
  type PricingBenchmarkFilter,
  type PricingBenchmarkPayload,
  type Season,
} from '../../../services/tourismKnowledgeService';
import {
  parseOptionalNumber,
  parseOptionalInt,
  numberOrEmpty,
  confidenceBucket,
} from './helpers';
import styles from './TourismKnowledge.module.css';

const DURATION_BUCKETS: DurationBucket[] = ['half_day', 'full_day', 'multi_day'];
const SEASONS: Season[] = ['year_round', 'spring', 'summer', 'autumn', 'winter'];

interface FormState {
  category: string;
  council: string;
  duration_bucket: DurationBucket;
  season: Season;
  median_price: string;
  p25: string;
  p75: string;
  sample_size: string;
  currency: string;
}

const emptyForm: FormState = {
  category: '',
  council: '',
  duration_bucket: 'full_day',
  season: 'year_round',
  median_price: '',
  p25: '',
  p75: '',
  sample_size: '0',
  currency: 'AUD',
};

const confidenceClass: Record<string, string> = {
  high: styles.confidenceHigh,
  normal: styles.confidenceNormal,
  low: styles.confidenceLow,
  insufficient: styles.confidenceNone,
};

export const PricingBenchmarkList: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ApiPricingBenchmark[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PricingBenchmarkFilter>({ page: 1, page_size: 20 });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiPricingBenchmark | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ApiPricingBenchmark | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await tourismKnowledgeService.listPricingBenchmarks(filter);
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

  const openEdit = (row: ApiPricingBenchmark) => {
    setEditing(row);
    setFormData({
      category: row.category,
      council: row.council,
      duration_bucket: row.duration_bucket,
      season: row.season,
      median_price: numberOrEmpty(row.median_price),
      p25: numberOrEmpty(row.p25),
      p75: numberOrEmpty(row.p75),
      sample_size: String(row.sample_size ?? 0),
      currency: row.currency || 'AUD',
    });
    setFormOpen(true);
  };

  const submit = async () => {
    if (!formData.category.trim() || !formData.council.trim()) {
      alert(t('admin.tourism.errors.categoryCouncilRequired', 'Category 和 Council 为必填'));
      return;
    }
    setSaving(true);
    try {
      const payload: PricingBenchmarkPayload = {
        category: formData.category.trim(),
        council: formData.council.trim(),
        duration_bucket: formData.duration_bucket,
        season: formData.season,
        median_price: parseOptionalNumber(formData.median_price),
        p25: parseOptionalNumber(formData.p25),
        p75: parseOptionalNumber(formData.p75),
        sample_size: parseOptionalInt(formData.sample_size) ?? 0,
        currency: formData.currency.trim() || 'AUD',
      };
      if (editing) {
        await tourismKnowledgeService.updatePricingBenchmark(editing.id, payload);
      } else {
        await tourismKnowledgeService.createPricingBenchmark(payload);
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      // Backend returns 409 with code DUPLICATE_PRICING_BENCHMARK on UNIQUE
      // collision — surface a friendlier message than the raw store error.
      const msg = err instanceof Error ? err.message : 'Save failed';
      if (msg.includes('DUPLICATE') || msg.includes('duplicate') || msg.includes('已存在')) {
        alert(
          t(
            'admin.tourism.pricing.duplicateError',
            '已存在同 (category, council, duration_bucket, season) 的行情记录',
          ),
        );
      } else {
        alert(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await tourismKnowledgeService.deletePricingBenchmark(deleteConfirm.id);
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
          <span className={styles.filterLabel}>{t('admin.tourism.filter.category', 'Category')}</span>
          <input
            className={styles.filterInput}
            value={filter.category ?? ''}
            placeholder="wine / wildlife / urban ..."
            onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value, page: 1 }))}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Council</span>
          <input
            className={styles.filterInput}
            value={filter.council ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, council: e.target.value, page: 1 }))}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Duration</span>
          <select
            className={styles.filterSelect}
            value={filter.duration_bucket ?? ''}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                duration_bucket: (e.target.value || undefined) as DurationBucket | undefined,
                page: 1,
              }))
            }
          >
            <option value="">{t('admin.tourism.filter.all', '全部')}</option>
            {DURATION_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Season</span>
          <select
            className={styles.filterSelect}
            value={filter.season ?? ''}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                season: (e.target.value || undefined) as Season | undefined,
                page: 1,
              }))
            }
          >
            <option value="">{t('admin.tourism.filter.all', '全部')}</option>
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterActions}>
          <button className={styles.iconBtn} onClick={load} title={t('common.refresh', 'Refresh')}>
            <RefreshCw size={16} />
          </button>
          <button className={styles.addBtn} onClick={openCreate}>
            <Plus size={16} />
            {t('admin.tourism.pricing.add', '新增行情')}
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
                <th>Category</th>
                <th>Council</th>
                <th>Duration</th>
                <th>Season</th>
                <th className={styles.colNarrow}>{t('admin.tourism.pricing.median', '中位价')}</th>
                <th className={styles.colNarrow}>P25</th>
                <th className={styles.colNarrow}>P75</th>
                <th className={styles.colNarrow}>{t('admin.tourism.pricing.samples', '样本')}</th>
                <th className={styles.colNarrow}>{t('admin.tourism.pricing.confidence', '置信度')}</th>
                <th className={styles.colNarrow}>{t('admin.tourism.col.actions', '操作')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const confidence = confidenceBucket(r.sample_size);
                return (
                  <tr key={r.id}>
                    <td className={styles.colNarrow}>{r.id}</td>
                    <td>{r.category}</td>
                    <td>{r.council}</td>
                    <td>{r.duration_bucket}</td>
                    <td>{r.season}</td>
                    <td className={styles.colNarrow}>{r.median_price ?? '—'}</td>
                    <td className={styles.colNarrow}>{r.p25 ?? '—'}</td>
                    <td className={styles.colNarrow}>{r.p75 ?? '—'}</td>
                    <td className={styles.colNarrow}>{r.sample_size}</td>
                    <td className={styles.colNarrow}>
                      <span
                        className={`${styles.confidenceBadge} ${confidenceClass[confidence] ?? ''}`}
                      >
                        {confidence}
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
                );
              })}
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
            ? t('admin.tourism.pricing.editTitle', '编辑行情')
            : t('admin.tourism.pricing.createTitle', '新增行情')
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
              <label>Category *</label>
              <input
                value={formData.category}
                placeholder="wine / wildlife / urban / hike ..."
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Council *</label>
              <input
                value={formData.council}
                placeholder="Adelaide Hills"
                onChange={(e) => setFormData((p) => ({ ...p, council: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Duration Bucket *</label>
              <select
                value={formData.duration_bucket}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, duration_bucket: e.target.value as DurationBucket }))
                }
              >
                {DURATION_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Season *</label>
              <select
                value={formData.season}
                onChange={(e) => setFormData((p) => ({ ...p, season: e.target.value as Season }))}
              >
                {SEASONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.tourism.pricing.median', '中位价')}</label>
              <input
                type="number"
                step="0.01"
                value={formData.median_price}
                onChange={(e) => setFormData((p) => ({ ...p, median_price: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>P25 / P75</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="P25"
                  value={formData.p25}
                  onChange={(e) => setFormData((p) => ({ ...p, p25: e.target.value }))}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="P75"
                  value={formData.p75}
                  onChange={(e) => setFormData((p) => ({ ...p, p75: e.target.value }))}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>
                {t('admin.tourism.pricing.samples', '样本数')}{' '}
                <span className={styles.helperText}>
                  {t('admin.tourism.pricing.sampleHelper', '<3 不足 / 3-4 低 / 5-11 正常 / ≥12 高')}
                </span>
              </label>
              <input
                type="number"
                min={0}
                value={formData.sample_size}
                onChange={(e) => setFormData((p) => ({ ...p, sample_size: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Currency</label>
              <input
                value={formData.currency}
                onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))}
              />
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
            ? t('admin.tourism.pricing.deleteMessage', '确定要删除「{{cat}} / {{council}} / {{bucket}} / {{season}}」行情吗？', {
                cat: deleteConfirm.category,
                council: deleteConfirm.council,
                bucket: deleteConfirm.duration_bucket,
                season: deleteConfirm.season,
              })
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
};

export default PricingBenchmarkList;
