/**
 * REQ-20260510-0001 F2 · Supplier 双语 C 端预览页
 *
 * 路由: /supplier/products/:id/preview-bilingual
 *
 * 用户进入：supplier 在 SupplierProductFormPage 点 "Save & Submit for review"
 * → handleSaveAndSubmit 改为 save 后 navigate 到本页（不再直接跳列表）
 *
 * 关键交互（PRD v1.1 + 缺陷修订）:
 *   - 桌面端 50/50 双栏 (左 ZH 右 EN)；移动端 Tab 切换
 *   - 顶部状态条 4 态: in_progress / failed / unknown / ready
 *   - 缺陷 #4: supplier failed 仅显 [Back to Edit]，无 Retry
 *   - 缺陷 #5: submit 时若仍 in_progress，toast 提示 "admin will see it once ready"
 *   - 缺陷 #6: BroadcastChannel 同 productId 多 tab 警告
 *   - 缺陷 #11: review_status='pending' 时 Submit 按钮变 "Already Submitted"
 *   - 子表 hint: highlights/packages/FAQ 任一语言空显黄条
 *   - 渲染层 fallback: 翻译 in_progress + 当前语言空字段 → 用 SkeletonColumn 替代 ProductDetailPage
 *
 * 后端零改动；复用 supplierProductService.{getById, submitForReview, getTranslationStatus}
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { Button, Loading } from '../../../components/Common';
import { ProductDetailPage } from '../../ProductDetailPage/ProductDetailPage';
import { transformApiProduct } from '../../../services/productService';
import type { ApiProduct } from '../../../services/productService';
import { supplierProductService } from '../../../services/supplierProductService';
import { useUnifiedTranslationStatus, type UnifiedStatus } from '../../../hooks/useUnifiedTranslationStatus';
import styles from './SupplierProductPreviewBilingualPage.module.css';

export interface SupplierProductPreviewBilingualPageProps {
  productId?: string;
  onNavigate?: (path: string) => void;
}

type Locale = 'zh' | 'en';

export const SupplierProductPreviewBilingualPage: React.FC<SupplierProductPreviewBilingualPageProps> = ({
  productId,
  onNavigate,
}) => {
  const { t } = useTranslation();

  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<Locale>('zh');
  const [multiTabWarning, setMultiTabWarning] = useState(false);

  // ── 1. fetch product ──
  const refetchProduct = useCallback(async () => {
    if (!productId) {
      setLoading(false);
      return;
    }
    const id = Number(productId);
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await supplierProductService.getById(id);
      setProduct(data);
    } catch {
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    refetchProduct();
  }, [refetchProduct]);

  // ── 2. translation status hook ──
  const numericProductId = productId ? Number(productId) : null;
  const { status: translationStatus, refresh: refreshTranslationStatus } =
    useUnifiedTranslationStatus('supplier', numericProductId);

  // 翻译 ready 时刷新一次 product 拿到最新 ZH 字段
  const prevStatusRef = React.useRef<UnifiedStatus>('in_progress');
  useEffect(() => {
    if (prevStatusRef.current !== 'ready' && translationStatus === 'ready') {
      refetchProduct();
    }
    prevStatusRef.current = translationStatus;
  }, [translationStatus, refetchProduct]);

  // ── 3. Multi-tab BroadcastChannel 警告（缺陷 #6）──
  useEffect(() => {
    if (!productId || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('enjoysa-product-edit');
    const tabId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    ch.postMessage({ type: 'open', productId, tabId });

    ch.onmessage = (e) => {
      if (e.data?.type === 'open' && e.data.productId === productId && e.data.tabId !== tabId) {
        // 已有其他 tab 打开同 productId
        setMultiTabWarning(true);
        // 通知对方"我已存在"
        ch.postMessage({ type: 'already_open', productId, tabId });
      }
      if (e.data?.type === 'already_open' && e.data.productId === productId && e.data.tabId !== tabId) {
        setMultiTabWarning(true);
      }
    };

    return () => {
      ch.postMessage({ type: 'close', productId, tabId });
      ch.close();
    };
  }, [productId]);

  // ── 4. 转换 ApiProduct → Product（喂给 ProductDetailPage） ──
  const previewData = useMemo(() => (product ? transformApiProduct(product) : null), [product]);

  // ── 5. 子表语言完整性检查（hint banner）──
  const subTableGaps = useMemo(() => {
    if (!product) return [] as string[];
    const gaps: string[] = [];
    if (product.highlights && product.highlights.length > 0) {
      const missingZh = product.highlights.some((h) => !h.title_zh?.trim());
      const missingEn = product.highlights.some((h) => !h.title_en?.trim());
      if (missingZh) gaps.push('highlights:zh');
      if (missingEn) gaps.push('highlights:en');
    }
    if (product.faqs && product.faqs.length > 0) {
      const missingZh = product.faqs.some((f) => !f.question_zh?.trim() || !f.answer_zh?.trim());
      const missingEn = product.faqs.some((f) => !f.question_en?.trim() || !f.answer_en?.trim());
      if (missingZh) gaps.push('FAQ:zh');
      if (missingEn) gaps.push('FAQ:en');
    }
    return gaps;
  }, [product]);

  // ── 6. Submit 行为 ──
  // review_status='pending' / 'reviewing' → 已提交，按钮禁用 + 文案 "Already Submitted"
  const reviewStatus = product?.status; // 'draft' | 'pending' | 'approved' | 'rejected' | 'archived'
  const alreadySubmitted = reviewStatus === 'pending' || reviewStatus === 'reviewing';

  const handleSubmit = async () => {
    if (!productId || alreadySubmitted) {
      // 已提交 → 直接跳列表
      onNavigate?.('/supplier/products');
      return;
    }
    if (translationStatus === 'failed') return; // 失败时按钮已 disabled
    setSubmitting(true);
    try {
      await supplierProductService.submitForReview(Number(productId));
      // 缺陷 #5: in_progress 提交时 toast 提示
      if (translationStatus === 'in_progress') {
        // 用 alert 简化（项目无统一 toast 库）；F3 admin 端可换更精致的提示
        alert(t('preview.translationInProgress'));
      }
      onNavigate?.('/supplier/products');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToEdit = () => {
    if (productId) onNavigate?.(`/supplier/products/${productId}/edit`);
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingScreen}>
          <Loading size="lg" />
        </div>
      </div>
    );
  }

  if (!product || !previewData) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>⚠️</div>
          <div>Product not found.</div>
          <Button variant="outline" size="md" onClick={handleBackToEdit} style={{ marginTop: 16 }}>
            {t('preview.backToEdit')}
          </Button>
        </div>
      </div>
    );
  }

  const submitDisabled = submitting || translationStatus === 'failed';

  return (
    <div className={styles.page}>
      {/* ===== Top banners ===== */}
      <StatusBanner
        status={translationStatus}
        onRefresh={refreshTranslationStatus}
      />
      {multiTabWarning && (
        <div className={`${styles.banner} ${styles.bannerMultiTab}`}>
          ⚠️ {t('preview.alreadyOpenInAnotherTab')}
        </div>
      )}
      {subTableGaps.length > 0 && (
        <div className={styles.subTableHints}>
          ℹ️ {t('preview.sectionOnlyAvailableIn', { lang: 'one language' })}:
          <ul>
            {subTableGaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ===== Mobile tabs ===== */}
      <div className={styles.mobileTabs}>
        <button
          type="button"
          className={`${styles.mobileTab} ${activeTab === 'zh' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('zh')}
        >
          🇨🇳 中文
        </button>
        <button
          type="button"
          className={`${styles.mobileTab} ${activeTab === 'en' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('en')}
        >
          🇬🇧 English
        </button>
      </div>

      {/* ===== Two-column body ===== */}
      <div className={styles.columnsContainer}>
        <PreviewColumn
          locale="zh"
          product={product}
          previewData={previewData}
          translationStatus={translationStatus}
          isHiddenOnMobile={activeTab !== 'zh'}
        />
        <PreviewColumn
          locale="en"
          product={product}
          previewData={previewData}
          translationStatus={translationStatus}
          isHiddenOnMobile={activeTab !== 'en'}
        />
      </div>

      {/* ===== Sticky bottom bar ===== */}
      <div className={styles.stickyBar}>
        <Button variant="outline" size="md" onClick={handleBackToEdit}>
          <ChevronLeft size={16} style={{ marginRight: 4 }} />
          {t('preview.backToEdit')}
        </Button>
        <Button
          variant="primary"
          size="md"
          disabled={submitDisabled}
          onClick={handleSubmit}
        >
          {alreadySubmitted ? t('preview.alreadySubmitted') : t('preview.submitForReview')}
        </Button>
      </div>
    </div>
  );
};

/* ============================================================ */
/*  Sub-components                                               */
/* ============================================================ */

const StatusBanner: React.FC<{ status: UnifiedStatus; onRefresh: () => void }> = ({ status, onRefresh }) => {
  const { t } = useTranslation();
  if (status === 'ready') return null;
  if (status === 'in_progress') {
    return (
      <div className={`${styles.banner} ${styles.bannerInProgress}`}>
        <span className={styles.bannerSpinner} />
        <span style={{ flex: 1 }}>{t('preview.translationInProgress')}</span>
      </div>
    );
  }
  if (status === 'failed') {
    // 缺陷 #4 修订: supplier 端 failed 状态无 Retry，仅 Back to Edit（Back 按钮在底部 sticky bar）
    return (
      <div className={`${styles.banner} ${styles.bannerFailed}`}>
        <span>❌</span>
        <span style={{ flex: 1 }}>{t('preview.translationFailed')}</span>
      </div>
    );
  }
  // unknown
  return (
    <div className={`${styles.banner} ${styles.bannerUnknown}`}>
      <span>⏰</span>
      <span style={{ flex: 1 }}>{t('preview.translationTakingLonger')}</span>
      <button type="button" className={styles.bannerButton} onClick={onRefresh}>
        {t('preview.refresh')}
      </button>
    </div>
  );
};

interface PreviewColumnProps {
  locale: Locale;
  product: ApiProduct;
  previewData: ReturnType<typeof transformApiProduct>;
  translationStatus: UnifiedStatus;
  isHiddenOnMobile: boolean;
}

const PreviewColumn: React.FC<PreviewColumnProps> = ({
  locale,
  product,
  previewData,
  translationStatus,
  isHiddenOnMobile,
}) => {
  // 当前 locale 关键字段是否为空
  const hasContent = locale === 'zh'
    ? Boolean(product.name_zh?.trim())
    : Boolean(product.name_en?.trim());

  const showSkeleton = !hasContent && translationStatus === 'in_progress';
  const showEmpty = !hasContent && (translationStatus === 'failed' || translationStatus === 'unknown' || translationStatus === 'ready');

  return (
    <div className={`${styles.column} ${isHiddenOnMobile ? styles.columnHidden : ''}`}>
      <div className={styles.columnHeader}>
        <span className={styles.columnLabel}>
          {locale === 'zh' ? '🇨🇳 中文预览' : '🇬🇧 English Preview'}
        </span>
        <span className={styles.sourceSummary}>
          {locale === 'zh' ? translationStatus : 'manual'}
        </span>
      </div>
      <div className={styles.columnBody}>
        {showSkeleton && <SkeletonProductCard />}
        {showEmpty && <EmptyContentCard locale={locale} />}
        {hasContent && (
          <ProductDetailPage
            previewMode
            previewData={previewData}
            language={locale}
          />
        )}
      </div>
    </div>
  );
};

const SkeletonProductCard: React.FC = () => (
  <div className={styles.skeletonContainer}>
    <div className={styles.skeletonImage} />
    <div className={`${styles.skeletonLine} ${styles.skeletonLineLg} ${styles.skeletonLineW75}`} />
    <div className={`${styles.skeletonLine} ${styles.skeletonLineW50}`} />
    <div className={`${styles.skeletonLine} ${styles.skeletonLineW100}`} />
    <div className={`${styles.skeletonLine} ${styles.skeletonLineW100}`} />
    <div className={`${styles.skeletonLine} ${styles.skeletonLineW75}`} />
    <div style={{ height: 16 }} />
    <div className={`${styles.skeletonLine} ${styles.skeletonLineLg} ${styles.skeletonLineW50}`} />
    <div className={`${styles.skeletonLine} ${styles.skeletonLineW100}`} />
    <div className={`${styles.skeletonLine} ${styles.skeletonLineW100}`} />
  </div>
);

const EmptyContentCard: React.FC<{ locale: Locale }> = ({ locale }) => {
  const { t } = useTranslation();
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateIcon}>📝</div>
      <div>
        {t('preview.sectionOnlyAvailableIn', {
          lang: locale === 'zh' ? 'English' : '中文',
        })}
      </div>
    </div>
  );
};

export default SupplierProductPreviewBilingualPage;
