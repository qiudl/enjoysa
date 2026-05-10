// REQ-20260510-0011 · Phase 2 · 2C-3
//
// Scrape staging list — admin reviews LLM-extracted candidates before
// they get promoted into tourism_attractions.
//
// Layout:
//   - Top toolbar: "运行抓取" button + status filter (pending/promoted/rejected)
//   - List: one card per staging row showing extracted payload + Promote/Reject
//   - Reject opens a small reason input
//
// Design intent: keep the review surface minimal — admin should be able to
// promote a clean candidate in a single click. Rejecting requires typing
// a reason so we capture why for future scraper-prompt tuning.

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Check, X, Loader2 } from 'lucide-react';
import {
  tourismKnowledgeService,
  type ScrapeJob,
  type ScrapeStaging,
} from '../../../services/tourismKnowledgeService';
import styles from './TourismKnowledge.module.css';

type StatusFilter = '' | 'pending' | 'promoted' | 'rejected';

export const ScrapeStagingList: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ScrapeStaging[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [page, setPage] = useState(1);

  // Run-scrape state
  const [scraping, setScraping] = useState(false);
  const [scrapeJob, setScrapeJob] = useState<ScrapeJob | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Per-row action state
  const [busyRowId, setBusyRowId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await tourismKnowledgeService.listScrapeStaging({
        status: statusFilter || undefined,
        page,
        page_size: 20,
      });
      setRows(r.items || []);
      setTotal(r.total || 0);
    } catch {
      /* leave previous list */
    }
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const triggerScrape = async () => {
    if (scraping) return;
    if (
      !window.confirm(
        t(
          'admin.tourism.scrape.confirm',
          '将抓取南澳旅游局公开页面，调 LLM 抽结构化数据写入 staging。\n约 1-2 分钟。继续？',
        ),
      )
    ) {
      return;
    }
    setScraping(true);
    setScrapeError(null);
    setScrapeJob(null);
    try {
      const job = await tourismKnowledgeService.runScrape();
      setScrapeJob(job);
      // Reload list once scrape finishes — likely many new pending rows.
      await load();
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Scrape failed');
    } finally {
      setScraping(false);
    }
  };

  const handlePromote = async (id: number) => {
    if (busyRowId) return;
    setBusyRowId(id);
    try {
      await tourismKnowledgeService.promoteScrapeStaging(id);
      // Optimistic: drop the row from the pending view (refresh from server next).
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Promote failed');
    } finally {
      setBusyRowId(null);
    }
  };

  const openRejectInline = (id: number) => {
    setRejectingId(id);
    setRejectReason('');
  };

  const submitReject = async () => {
    if (rejectingId == null || busyRowId) return;
    setBusyRowId(rejectingId);
    try {
      await tourismKnowledgeService.rejectScrapeStaging(rejectingId, rejectReason.trim());
      setRows((prev) => prev.filter((r) => r.id !== rejectingId));
      setTotal((n) => Math.max(0, n - 1));
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyRowId(null);
    }
  };

  return (
    <>
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('admin.tourism.filter.status', 'Status')}</span>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="">{t('admin.tourism.scrape.all', '全部')}</option>
            <option value="pending">{t('admin.tourism.scrape.pending', '待审核')}</option>
            <option value="promoted">{t('admin.tourism.scrape.promoted', '已采用')}</option>
            <option value="rejected">{t('admin.tourism.scrape.rejected', '已拒')}</option>
          </select>
        </div>
        <div className={styles.filterActions}>
          <button className={styles.iconBtn} onClick={load} title={t('common.refresh', 'Refresh')}>
            <RefreshCw size={16} />
          </button>
          <button className={styles.addBtn} onClick={triggerScrape} disabled={scraping}>
            {scraping ? <Loader2 size={16} className={styles.spinIcon} /> : <Plus size={16} />}
            {scraping
              ? t('admin.tourism.scrape.running', '正在抓取...')
              : t('admin.tourism.scrape.run', '运行抓取')}
          </button>
        </div>
      </div>

      {scrapeJob && (
        <div className={styles.etlSummary} role="status">
          <strong>{t('admin.tourism.scrape.jobDone', '抓取任务结束')}</strong>{' '}
          {t(
            'admin.tourism.scrape.jobSummary',
            '状态 {{status}}，扫描 {{total}} URL，新增 staging {{exp}}，跳过 {{skip}}，错误 {{err}}',
            {
              status: scrapeJob.status,
              total: scrapeJob.total_urls,
              exp: scrapeJob.extracted_rows,
              skip: scrapeJob.skipped_rows,
              err: scrapeJob.error_count,
            },
          )}
          {scrapeJob.last_error && (
            <details className={styles.etlErrors}>
              <summary>{t('admin.tourism.scrape.lastError', '最后一条错误')}</summary>
              <code>{scrapeJob.last_error}</code>
            </details>
          )}
        </div>
      )}
      {scrapeError && (
        <div className={styles.etlError} role="alert">
          {scrapeError}
        </div>
      )}

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>{t('admin.tourism.scrape.empty', '暂无 staging 数据')}</div>
        ) : (
          <ul className={styles.scrapeList}>
            {rows.map((r) => (
              <li key={r.id} className={styles.scrapeCard}>
                <div className={styles.scrapeCardHeader}>
                  <div>
                    <div className={styles.scrapeCardTitle}>
                      {r.extracted_payload.name_zh || '(no name_zh)'}
                      {r.extracted_payload.name_en && (
                        <span className={styles.scrapeCardTitleEn}>
                          {' '}
                          / {r.extracted_payload.name_en}
                        </span>
                      )}
                    </div>
                    <div className={styles.scrapeCardMeta}>
                      <a href={r.source_url} target="_blank" rel="noreferrer">
                        {r.source_url}
                      </a>
                    </div>
                  </div>
                  <span
                    className={`${styles.statusBadge} ${
                      r.status === 'pending'
                        ? styles.statusInactive
                        : r.status === 'promoted'
                        ? styles.statusActive
                        : styles.statusInactive
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className={styles.scrapeCardBody}>
                  <div className={styles.scrapeFieldRow}>
                    <strong>Council:</strong> {r.extracted_payload.council || '—'}
                  </div>
                  <div className={styles.scrapeFieldRow}>
                    <strong>Category:</strong> {r.extracted_payload.category || '—'}
                  </div>
                  {r.extracted_payload.description_zh && (
                    <div className={styles.scrapeFieldRow}>
                      <strong>{t('admin.tourism.col.description', '描述')}:</strong>{' '}
                      {r.extracted_payload.description_zh}
                    </div>
                  )}
                  {r.extracted_payload.tags && r.extracted_payload.tags.length > 0 && (
                    <div className={styles.scrapeFieldRow}>
                      {r.extracted_payload.tags.map((tag) => (
                        <span key={tag} className={styles.tagPill}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.extraction_confidence && (
                    <div className={styles.scrapeFieldRow}>
                      <span
                        className={`${styles.confidenceBadge} ${
                          styles[
                            r.extraction_confidence === 'high'
                              ? 'confidenceHigh'
                              : r.extraction_confidence === 'medium'
                              ? 'confidenceNormal'
                              : 'confidenceLow'
                          ]
                        }`}
                      >
                        {r.extraction_confidence}
                      </span>
                    </div>
                  )}
                </div>
                {r.status === 'pending' && (
                  <div className={styles.scrapeCardActions}>
                    {rejectingId === r.id ? (
                      <div className={styles.rejectInline}>
                        <input
                          className={styles.filterInput}
                          placeholder={t(
                            'admin.tourism.scrape.rejectReasonPlaceholder',
                            '拒绝原因（可选）',
                          )}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          autoFocus
                        />
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={submitReject}
                          disabled={busyRowId === r.id}
                        >
                          {t('admin.tourism.scrape.confirmReject', '确认拒绝')}
                        </button>
                        <button
                          className={styles.actionBtn}
                          onClick={() => setRejectingId(null)}
                        >
                          {t('common.cancel', '取消')}
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          className={styles.actionBtn}
                          onClick={() => handlePromote(r.id)}
                          disabled={busyRowId === r.id}
                        >
                          {busyRowId === r.id ? (
                            <Loader2 size={12} className={styles.spinIcon} />
                          ) : (
                            <Check size={12} />
                          )}{' '}
                          {t('admin.tourism.scrape.promote', '采用')}
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => openRejectInline(r.id)}
                          disabled={busyRowId === r.id}
                        >
                          <X size={12} /> {t('admin.tourism.scrape.reject', '拒绝')}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {r.status === 'promoted' && r.promoted_to_id && (
                  <div className={styles.scrapeCardFooter}>
                    {t('admin.tourism.scrape.promotedTo', '已写入 attraction id={{id}}', {
                      id: r.promoted_to_id,
                    })}
                  </div>
                )}
                {r.status === 'rejected' && r.reject_reason && (
                  <div className={styles.scrapeCardFooter}>
                    {t('admin.tourism.scrape.rejectedFor', '已拒：{{reason}}', {
                      reason: r.reject_reason,
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {!loading && rows.length > 0 && (
          <div className={styles.paginationFooter}>
            <span>{t('admin.tourism.pagination.summary', '共 {{total}} 条', { total })}</span>
            <div className={styles.paginationButtons}>
              <button
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('common.prev', '上一页')}
              </button>
              <button
                className={styles.pageBtn}
                disabled={page * 20 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('common.next', '下一页')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ScrapeStagingList;
