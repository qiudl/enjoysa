// REQ-20260511-0006: /admin/banners 重构。
//
// 旧设计：banners 是独立 CRUD 实体（title/subtitle/image URL/link/sort），
// 但 C 端 HeroBanner 实际读 bannerSlides.ts 静态数据，此页面历史无效。
//
// 新设计：直接从「推荐产品」(is_featured=true) 列出，admin 在表内为每个
// 产品上传 banner_image + 调 carousel_rank。HeroBanner 由
// GET /banners/carousel 驱动，规则：is_featured=true AND banner_image
// IS NOT NULL，按 carousel_rank ASC NULLS LAST 排序，最多 5 张。
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Image as ImageIcon, ExternalLink, AlertTriangle } from 'lucide-react';
import { adminService, type ApiAdminProduct } from '../../../services/adminService';
import styles from './BannerList.module.css';

const MAX_CAROUSEL = 5;
// 1920×640 = 3:1。Soft warning if uploaded image deviates significantly.
const TARGET_RATIO = 3;
const RATIO_TOLERANCE = 0.5; // accept ratios in [2.5, 3.5]

export interface BannerListProps {
  onNavigate?: (path: string) => void;
}

export const BannerList: React.FC<BannerListProps> = ({ onNavigate }) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');

  const [products, setProducts] = useState<ApiAdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await adminService.listProducts({
        page: 1,
        page_size: 100,
        is_featured: true,
      });
      setProducts(result.items || []);
    } catch (err) {
      console.error('Failed to load featured products', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Active carousel = products with banner_image set, sorted by rank.
  const activeCount = useMemo(
    () => products.filter((p) => !!p.banner_image).length,
    [products],
  );
  const overCap = activeCount > MAX_CAROUSEL;

  const handleUpload = async (productId: number, file: File) => {
    setSavingId(productId);
    setWarning(null);
    try {
      // Soft aspect-ratio check (no hard reject).
      const dims = await readImageDims(file);
      if (dims) {
        const ratio = dims.w / dims.h;
        if (ratio < TARGET_RATIO - RATIO_TOLERANCE || ratio > TARGET_RATIO + RATIO_TOLERANCE) {
          setWarning(
            isZh
              ? `图片尺寸 ${dims.w}×${dims.h} (≈${ratio.toFixed(2)}:1) 与推荐 3:1 差异较大，可能在 carousel 显示变形。`
              : `Uploaded image ${dims.w}×${dims.h} (≈${ratio.toFixed(2)}:1) deviates from the recommended 3:1 — may distort in the carousel.`,
          );
        }
      }
      const url = await adminService.uploadFile(file);
      await adminService.updateProductBanner(productId, { banner_image: url });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, banner_image: url } : p)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    }
    setSavingId(null);
  };

  const handleClearImage = async (productId: number) => {
    if (!confirm(isZh ? '清除该产品的 banner 图（将从首页 carousel 移除）？' : 'Clear banner image (removes from homepage carousel)?')) {
      return;
    }
    setSavingId(productId);
    try {
      await adminService.updateProductBanner(productId, { banner_image: '' });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, banner_image: '' } : p)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to clear');
    }
    setSavingId(null);
  };

  const handleRankChange = async (productId: number, rawValue: string) => {
    const trimmed = rawValue.trim();
    const next = trimmed === '' ? null : Number(trimmed);
    if (next !== null && (!Number.isFinite(next) || next < 0)) return;

    // Optimistic
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, carousel_rank: next } : p)),
    );
    try {
      await adminService.updateProductBanner(productId, { carousel_rank: next });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save rank');
      // Reload on failure to drop the optimistic value.
      loadData();
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>
            {isZh ? '首页 Banner 管理' : 'Hero Banner Management'}
          </h1>
          <p className={styles.pageDescription}>
            {isZh
              ? '为「推荐产品」上传 banner 图并调整顺序，决定首页 hero carousel 出现哪些产品。'
              : 'Upload banner images and rank for products marked "Featured" — drives the homepage hero carousel.'}
          </p>
        </div>
      </div>

      {/* Status bar */}
      <div className={`${styles.toolbar} ${overCap ? styles.toolbarWarn : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {overCap && <AlertTriangle size={16} color="#b45309" />}
          <span style={{ fontSize: 14 }}>
            {isZh
              ? `当前活跃 carousel：${activeCount} / 上限 ${MAX_CAROUSEL}`
              : `Active carousel: ${activeCount} / cap ${MAX_CAROUSEL}`}
            {overCap && (
              <span style={{ marginLeft: 8, color: '#b45309' }}>
                {isZh
                  ? '— 超过上限，调 carousel rank 决定哪些出。'
                  : '— above cap; tweak carousel rank to choose which 5 show.'}
              </span>
            )}
          </span>
        </div>
        <button className={styles.iconBtn} onClick={loadData} title={t('common.refresh', 'Refresh')}>
          <RefreshCw size={18} />
        </button>
      </div>

      {warning && (
        <div className={styles.toolbarWarn} style={{ padding: '0.5rem 1rem', fontSize: 13 }}>
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {warning}
        </div>
      )}

      {/* Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : products.length === 0 ? (
          <div className={styles.empty}>
            {isZh
              ? '暂无推荐产品。先在产品编辑页勾选「推荐」，再回这里配 banner 图。'
              : 'No featured products yet. Mark a product as "Featured" in its edit page, then come back to upload its banner image.'}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{isZh ? '封面' : 'Cover'}</th>
                <th>{isZh ? '名称（中）' : 'Name (ZH)'}</th>
                <th>{isZh ? '名称（英）' : 'Name (EN)'}</th>
                <th>{isZh ? 'Banner 图' : 'Banner Image'}</th>
                <th>{isZh ? 'Carousel 排序' : 'Carousel Rank'}</th>
                <th>{isZh ? '操作' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const inCarousel = !!p.banner_image;
                return (
                  <tr key={p.id} className={inCarousel ? styles.rowActive : ''}>
                    <td>
                      {p.images?.[0]?.url ? (
                        <img src={p.images[0].url} alt={p.name_zh} className={styles.thumbnail} />
                      ) : (
                        <div className={styles.thumbnailPlaceholder}>
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </td>
                    <td>{p.name_zh}</td>
                    <td style={{ color: '#6b7280' }}>{p.name_en}</td>
                    <td>
                      {p.banner_image ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img
                            src={p.banner_image}
                            alt="banner"
                            style={{ width: 120, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb' }}
                          />
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => fileInputs.current[p.id]?.click()}
                            disabled={savingId === p.id}
                          >
                            {isZh ? '替换' : 'Replace'}
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={() => handleClearImage(p.id)}
                            disabled={savingId === p.id}
                          >
                            {isZh ? '清除' : 'Clear'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => fileInputs.current[p.id]?.click()}
                          disabled={savingId === p.id}
                        >
                          {isZh ? '上传' : 'Upload'}
                        </button>
                      )}
                      <input
                        ref={(el) => { fileInputs.current[p.id] = el; }}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(p.id, f);
                          e.target.value = ''; // allow re-upload of same file
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        defaultValue={p.carousel_rank ?? ''}
                        placeholder={isZh ? '不排' : 'unranked'}
                        onBlur={(e) => {
                          const incoming = e.target.value.trim();
                          const current = p.carousel_rank ?? '';
                          if (String(current) !== incoming) {
                            handleRankChange(p.id, incoming);
                          }
                        }}
                        style={{ width: 80, padding: '4px 6px' }}
                        disabled={!inCarousel}
                        title={inCarousel ? '' : (isZh ? '先上传 banner 图' : 'Upload banner first')}
                      />
                    </td>
                    <td>
                      <button
                        className={styles.actionBtn}
                        onClick={() => onNavigate?.(`/admin/products/${p.id}/edit`)}
                      >
                        {isZh ? '编辑产品' : 'Edit Product'}
                        <ExternalLink size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ marginTop: '1rem', fontSize: 13, color: '#6b7280' }}>
        {isZh
          ? '推荐 banner 图尺寸 1920×640 (3:1)。规则：is_featured=true AND banner_image 已上传 → 进入 carousel；按 carousel_rank 排序（NULLS LAST），最多取 5 张。'
          : 'Recommended banner size 1920×640 (3:1). Rule: is_featured=true AND banner_image set → enters carousel; ordered by carousel_rank (NULLS LAST), capped at 5.'}
      </p>
    </div>
  );
};

// Read image dimensions client-side for the soft aspect-ratio warning.
async function readImageDims(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export default BannerList;
