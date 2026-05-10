import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Download, FileSpreadsheet } from 'lucide-react';
import { ApiError } from '../../../services/api';
import type { PackageFlat } from '../../../services/adminService';
import styles from './ExcelImport.module.css';

// Dynamic-imported on first use — keeps xlsx (~270 kB) out of the page's
// initial bundle so admins / suppliers who never click "Excel 导入" don't
// pay for it. Cached after first load via the loadXLSX() helper.
type XLSXModule = typeof import('xlsx');
let xlsxPromise: Promise<XLSXModule> | null = null;
const loadXLSX = (): Promise<XLSXModule> => {
  if (!xlsxPromise) xlsxPromise = import('xlsx');
  return xlsxPromise;
};

/**
 * REQ-20260510-0005 — Excel batch stock-adjust import.
 *
 * Reusable across admin / supplier list pages. Caller supplies the two
 * pluggable hooks (loadFlat = template/preview source, applyRow = PATCH
 * per row), the component owns parsing / validation / preview / chunked
 * apply / failure-row export.
 *
 * Why per-row PATCH instead of batch-stock: batch-stock applies one op
 * (add/sub/set/zero) to all rows uniformly, but Excel rows carry per-row
 * stock_total + threshold values. The PATCH endpoint already supports
 * both fields (REQ-20260510-0005 backend changes), so chunked PATCH
 * gives us per-row precision without a new endpoint.
 */
export interface ExcelImportProps {
  open: boolean;
  onClose: () => void;
  /** Fetch the flat package rows (admin = no scoping; supplier = own only). */
  loadFlat: () => Promise<PackageFlat[]>;
  /** Apply one row — caller decides admin vs supplier service. */
  applyRow: (row: ApplyRow) => Promise<void>;
  /** Fired after the apply phase completes; parent should refetch its list. */
  onCompleted?: (summary: { ok: number; failed: number }) => void;
  /** Visual hint for the modal title. */
  title?: string;
}

export interface ApplyRow {
  product_id: number;
  package_id: number;
  stock_total: number;
  low_stock_threshold?: number;
}

interface ParsedRow {
  /** 1-based row number from the spreadsheet for user-facing error messages. */
  rowNumber: number;
  product_id: number | null;
  package_id: number | null;
  stock_total: number | null;
  low_stock_threshold: number | null;
  errors: string[];
  // Mirror the raw cells so we can surface them in error export.
  raw: Record<string, unknown>;
}

const APPLY_CHUNK = 50;

const TEMPLATE_COLUMNS = [
  'product_id',
  'product_name_zh',
  'package_id',
  'package_name_zh',
  'stock_total',
  'low_stock_threshold',
] as const;

export const ExcelImport: React.FC<ExcelImportProps> = ({
  open,
  onClose,
  loadFlat,
  applyRow,
  onCompleted,
  title,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [flat, setFlat] = useState<PackageFlat[]>([]);
  const [flatLoading, setFlatLoading] = useState(false);
  const [flatError, setFlatError] = useState<string | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const [applying, setApplying] = useState(false);
  const [progressDone, setProgressDone] = useState(0);
  const [failedRows, setFailedRows] = useState<Array<ParsedRow & { reason: string }>>([]);
  const [doneSummary, setDoneSummary] = useState<{ ok: number; failed: number } | null>(null);

  // Build a lookup: package_id -> PackageFlat. Used both for validation
  // (stock_sold floor, ownership) and for the "package not found" error.
  const flatByPkgId = useMemo(() => {
    const m = new Map<number, PackageFlat>();
    flat.forEach((r) => m.set(r.package_id, r));
    return m;
  }, [flat]);

  useEffect(() => {
    if (!open) return;
    setFileName(null);
    setParsed([]);
    setParseError(null);
    setApplying(false);
    setProgressDone(0);
    setFailedRows([]);
    setDoneSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    let cancelled = false;
    setFlatLoading(true);
    setFlatError(null);
    loadFlat()
      .then((rows) => {
        if (cancelled) return;
        setFlat(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setFlatError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setFlatLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loadFlat]);

  const handleDownloadTemplate = async () => {
    if (flat.length === 0) return;
    const XLSX = await loadXLSX();
    // Pre-fill rows from the current packages so users see the existing
    // values and only need to edit the deltas. low_stock_threshold uses
    // the existing value (0 = alerts off).
    const data = flat.map((r) => ({
      product_id: r.product_id,
      product_name_zh: r.product_name_zh,
      package_id: r.package_id,
      package_name_zh: r.package_name_zh,
      stock_total: r.stock_total,
      low_stock_threshold: r.low_stock_threshold,
    }));
    const ws = XLSX.utils.json_to_sheet(data, { header: [...TEMPLATE_COLUMNS] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'stock_template');
    XLSX.writeFile(wb, `stock-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const validateRow = (raw: Record<string, unknown>, rowNumber: number): ParsedRow => {
    const errors: string[] = [];
    const productId = toIntOrNull(raw.product_id);
    const packageId = toIntOrNull(raw.package_id);
    const stockTotal = toIntOrNull(raw.stock_total);
    const lowThresholdRaw = raw.low_stock_threshold;
    const hasThreshold = lowThresholdRaw !== undefined && lowThresholdRaw !== null && lowThresholdRaw !== '';
    const lowThreshold = hasThreshold ? toIntOrNull(lowThresholdRaw) : null;

    if (productId === null || productId <= 0) errors.push(t('excelImport.errProductId', { defaultValue: 'product_id 必填且为正整数' }));
    if (packageId === null || packageId <= 0) errors.push(t('excelImport.errPackageId', { defaultValue: 'package_id 必填且为正整数' }));
    if (stockTotal === null) errors.push(t('excelImport.errStockTotalRequired', { defaultValue: 'stock_total 必填' }));
    else if (stockTotal < -1) errors.push(t('excelImport.errStockTotalRange', { defaultValue: 'stock_total 必须 >= -1（-1 = 无限量）' }));

    if (hasThreshold && (lowThreshold === null || lowThreshold < 0)) {
      errors.push(t('excelImport.errThreshold', { defaultValue: 'low_stock_threshold 必须 >= 0（0 = 不告警）' }));
    }

    if (errors.length === 0 && packageId !== null && stockTotal !== null) {
      const pkg = flatByPkgId.get(packageId);
      if (!pkg) {
        errors.push(t('excelImport.errPkgNotFound', {
          defaultValue: 'package_id {{id}} 不存在或不属于当前账户',
          id: packageId,
        }));
      } else if (productId !== null && pkg.product_id !== productId) {
        errors.push(t('excelImport.errPkgProductMismatch', {
          defaultValue: 'package_id 与 product_id 不匹配（应为 {{actual}}）',
          actual: pkg.product_id,
        }));
      } else if (stockTotal >= 0 && stockTotal < pkg.stock_sold) {
        errors.push(t('excelImport.errBelowSold', {
          defaultValue: 'stock_total ({{total}}) 不能低于已售 ({{sold}})',
          total: stockTotal,
          sold: pkg.stock_sold,
        }));
      }
    }

    return {
      rowNumber,
      product_id: productId,
      package_id: packageId,
      stock_total: stockTotal,
      low_stock_threshold: hasThreshold ? lowThreshold : null,
      errors,
      raw,
    };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setParsed([]);
    setFailedRows([]);
    setDoneSummary(null);
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) throw new Error('empty workbook');
      const ws = wb.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (rows.length === 0) {
        setParseError(t('excelImport.errEmpty', { defaultValue: '文件没有数据行' }) as string);
        return;
      }
      // sheet_to_json starts data at row 2 in spreadsheet terms (row 1 is header).
      const validated = rows.map((r, i) => validateRow(r, i + 2));
      setParsed(validated);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    }
  };

  const okRows = parsed.filter((r) => r.errors.length === 0);
  const errRows = parsed.filter((r) => r.errors.length > 0);
  const canApply = !applying && parsed.length > 0 && okRows.length > 0 && !flatLoading;

  const handleApply = async () => {
    if (!canApply) return;
    setApplying(true);
    setProgressDone(0);
    setFailedRows([]);
    setDoneSummary(null);
    const failures: Array<ParsedRow & { reason: string }> = [];
    let okCount = 0;

    // Chunked parallel apply. 50 in flight per chunk keeps the perceived
    // throughput high without saturating the rate limiter on the server.
    for (let i = 0; i < okRows.length; i += APPLY_CHUNK) {
      const chunk = okRows.slice(i, i + APPLY_CHUNK);
      const results = await Promise.allSettled(
        chunk.map((r) =>
          applyRow({
            product_id: r.product_id!,
            package_id: r.package_id!,
            stock_total: r.stock_total!,
            ...(r.low_stock_threshold !== null ? { low_stock_threshold: r.low_stock_threshold } : {}),
          }),
        ),
      );
      results.forEach((res, idx) => {
        const row = chunk[idx];
        if (res.status === 'fulfilled') {
          okCount += 1;
        } else {
          const reason = res.reason instanceof ApiError
            ? `${res.reason.code ?? res.reason.message}`
            : res.reason instanceof Error
              ? res.reason.message
              : String(res.reason);
          failures.push({ ...row, reason });
        }
      });
      setProgressDone((d) => d + chunk.length);
    }

    setFailedRows(failures);
    const summary = { ok: okCount, failed: failures.length };
    setDoneSummary(summary);
    setApplying(false);
    onCompleted?.(summary);
  };

  const handleDownloadFailures = async () => {
    if (failedRows.length === 0) return;
    const XLSX = await loadXLSX();
    const data = failedRows.map((r) => ({
      ...r.raw,
      error_reason: r.reason,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'errors');
    XLSX.writeFile(wb, `stock-import-errors-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>
              {title ?? t('excelImport.title', { defaultValue: 'Excel 批量导入库存' })}
            </h3>
            <div className={styles.subtitle}>
              {t('excelImport.subtitle', {
                defaultValue: '下载模板 → 编辑后上传 → 预览校验 → 一键应用（每批 {{n}} 行）',
                n: APPLY_CHUNK,
              })}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.stepRow}>
            <span className={styles.stepLabel}>1.</span>
            <span>{t('excelImport.stepDownload', { defaultValue: '下载现有套餐为模板（含已售数量校验上下文）' })}</span>
            <button
              className={styles.btnLight}
              onClick={handleDownloadTemplate}
              disabled={flatLoading || flat.length === 0}
            >
              <Download size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {t('excelImport.downloadTemplate', { defaultValue: '下载模板' })}
              {flatLoading && <Loader2 size={12} className={styles.spin} style={{ marginLeft: 6 }} />}
            </button>
            {!flatLoading && flat.length > 0 && (
              <span className={styles.fileName}>
                {t('excelImport.flatRowCount', { defaultValue: '{{n}} 行可用', n: flat.length })}
              </span>
            )}
            {flatError && <span className={styles.errReason}>{flatError}</span>}
          </div>

          <div className={styles.stepRow}>
            <span className={styles.stepLabel}>2.</span>
            <span>{t('excelImport.stepUpload', { defaultValue: '上传编辑好的 Excel / CSV' })}</span>
            <label className={styles.fileLabel}>
              <FileSpreadsheet size={14} />
              {t('excelImport.chooseFile', { defaultValue: '选择文件' })}
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={applying}
              />
            </label>
            {fileName && <span className={styles.fileName}>{fileName}</span>}
          </div>

          {parseError && <div className={styles.errorBanner}>{parseError}</div>}

          {parsed.length > 0 && (
            <>
              <div className={styles.summary}>
                <span>
                  {t('excelImport.totalRows', { defaultValue: '共 {{n}} 行', n: parsed.length })}
                </span>
                <span className={styles.summaryOk}>
                  {t('excelImport.okRows', { defaultValue: '✅ 可应用 {{n}}', n: okRows.length })}
                </span>
                {errRows.length > 0 && (
                  <span className={styles.summaryErr}>
                    {t('excelImport.errRows', { defaultValue: '❌ 错误 {{n}}', n: errRows.length })}
                  </span>
                )}
              </div>

              <div className={styles.previewWrap}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>product_id</th>
                      <th>package_id</th>
                      <th>stock_total</th>
                      <th>low_stock_threshold</th>
                      <th>{t('excelImport.colStatus', { defaultValue: '状态' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((r) => (
                      <tr
                        key={r.rowNumber}
                        className={r.errors.length === 0 ? styles.rowOk : styles.rowErr}
                      >
                        <td>{r.rowNumber}</td>
                        <td>{r.product_id ?? '—'}</td>
                        <td>{r.package_id ?? '—'}</td>
                        <td>{r.stock_total ?? '—'}</td>
                        <td>{r.low_stock_threshold ?? '—'}</td>
                        <td>
                          {r.errors.length === 0
                            ? <span style={{ color: '#1a7f1a' }}>OK</span>
                            : <span className={styles.errReason}>{r.errors.join('；')}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {applying && (
            <div className={styles.progressWrap}>
              <div>
                {t('excelImport.applying', {
                  defaultValue: '应用中… {{done}}/{{total}}',
                  done: progressDone,
                  total: okRows.length,
                })}
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${okRows.length === 0 ? 0 : (progressDone / okRows.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {doneSummary && (
            <div className={styles.successBanner}>
              {t('excelImport.doneSummary', {
                defaultValue: '已应用 {{ok}} 行，失败 {{failed}} 行',
                ok: doneSummary.ok,
                failed: doneSummary.failed,
              })}
              {doneSummary.failed > 0 && (
                <button
                  className={styles.btnLight}
                  style={{ marginLeft: 12 }}
                  onClick={handleDownloadFailures}
                >
                  {t('excelImport.downloadErrors', { defaultValue: '导出失败行' })}
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={applying}>
            {doneSummary
              ? t('common.close', { defaultValue: '关闭' })
              : t('common.cancel', { defaultValue: '取消' })}
          </button>
          {!doneSummary && (
            <button
              className={styles.applyBtn}
              onClick={handleApply}
              disabled={!canApply}
            >
              {applying && <Loader2 size={14} className={styles.spin} />}
              {t('excelImport.apply', {
                defaultValue: '应用 {{n}} 行',
                n: okRows.length,
              })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelImport;

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}
