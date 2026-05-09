import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import type { GeneratedContent } from '../../../services/aiService';
const ProductAiWriter = lazy(() => import('../../../components/AI/ProductAiWriter/ProductAiWriter'));
import {
  Check, ChevronLeft, ChevronRight, Plus, X, Image as ImageIcon,
  Star, GripVertical, Upload, Save, Send,
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supplierProductService } from '../../../services/supplierProductService';
import type { ImagePayload, PackagePayload, HighlightPayload, FAQPayload } from '../../../services/supplierProductService';
import { ChinesePreview } from '../../../components/Supplier/ChinesePreview';
import { regionService } from '../../../services/regionService';
import type { ApiRegion, ApiCategory } from '../../../services/regionService';
import styles from './SupplierProductFormPage.module.css';

// ────────────────────────────── Types ──────────────────────────────

interface ImageItem extends ImagePayload {
  _id: string; // local key for DnD
  _uploading?: boolean;
}

interface PackageItem extends PackagePayload {
  _id: string;
}

interface HighlightItem extends HighlightPayload {
  _id: string;
}

interface FAQItem extends FAQPayload {
  _id: string;
}

interface FormData {
  name_zh: string;
  name_en: string;
  summary_zh: string;
  summary_en: string;
  description_zh: string;
  description_en: string;
  region_id: number;
  category_id: number;
  price_from: string;
  duration: string;
  group_size: string;
  address_zh: string;
  address_en: string;
  tags: string;
}

export interface SupplierProductFormPageProps {
  productId?: string;
  onNavigate?: (path: string) => void;
}

const STEPS = ['basic', 'images', 'packages', 'extras', 'preview'] as const;
let _idCounter = 0;
function uid() {
  return `_${++_idCounter}_${Date.now()}`;
}

// ────────────────────────────── Sortable Image Card ──────────────────────────────

function SortableImage({
  item, isZh, onRemove, onSetCover,
}: {
  item: ImageItem;
  isZh: boolean;
  onRemove: () => void;
  onSetCover: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const t = useTranslation().t;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.imageCard} ${item.is_cover ? styles.isCover : ''}`}
    >
      <img src={item.url} alt="" loading="lazy" />
      {item.is_cover && <span className={styles.imageBadge}>{t('supplier.productForm.coverImage')}</span>}
      <div className={styles.imageActions}>
        {!item.is_cover && (
          <button type="button" className={styles.imageBtn} onClick={onSetCover} title={isZh ? '设为封面' : 'Set as cover'}>
            <Star size={12} />
          </button>
        )}
        <button
          type="button"
          className={`${styles.imageBtn} ${styles.dangerBtn}`}
          onClick={onRemove}
        >
          <X size={12} />
        </button>
        <button type="button" className={styles.imageBtn} {...attributes} {...listeners}>
          <GripVertical size={12} />
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────── Main Component ──────────────────────────────

export const SupplierProductFormPage: React.FC<SupplierProductFormPageProps> = ({
  productId,
  onNavigate,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';
  const isEditMode = !!productId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── State ───
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState<ApiRegion[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);

  const [productStatus, setProductStatus] = useState<string>('draft');
  const [form, setForm] = useState<FormData>({
    name_zh: '', name_en: '',
    summary_zh: '', summary_en: '',
    description_zh: '', description_en: '',
    region_id: 0, category_id: 0,
    price_from: '', duration: '', group_size: '',
    address_zh: '', address_en: '', tags: '',
  });

  const [images, setImages] = useState<ImageItem[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ─── Load regions & categories ───
  useEffect(() => {
    (async () => {
      try {
        const [r, c] = await Promise.all([regionService.getAllRaw(), regionService.getCategoriesRaw()]);
        setRegions(r);
        setCategories(c);
      } catch { /* ignore */ }
    })();
  }, []);

  // ─── Load product in edit mode ───
  useEffect(() => {
    if (!productId) return;
    (async () => {
      setLoading(true);
      try {
        const p = await supplierProductService.getById(Number(productId));
        setProductStatus(p.status || 'draft');
        setForm({
          name_zh: p.name_zh || '',
          name_en: p.name_en || '',
          summary_zh: p.summary_zh || '',
          summary_en: p.summary_en || '',
          description_zh: p.description_zh || '',
          description_en: p.description_en || '',
          region_id: p.region_id || 0,
          category_id: p.category_id || 0,
          price_from: p.price_from ? String(p.price_from) : '',
          duration: p.duration || '',
          group_size: p.group_size || '',
          address_zh: p.address_zh || '',
          address_en: p.address_en || '',
          tags: p.tags || '',
        });
        setImages(
          (p.images || []).map((img) => ({
            _id: uid(),
            url: img.url,
            sort_order: img.sort_order,
            is_cover: img.is_cover,
          })),
        );
        setPackages(
          (p.packages || []).map((pkg) => ({
            _id: uid(),
            name_zh: pkg.name_zh,
            name_en: pkg.name_en,
            desc_zh: pkg.desc_zh || '',
            desc_en: pkg.desc_en || '',
            price: pkg.price,
            // REQ-20260509-0035
            stock_total: pkg.stock_total ?? -1,
            stock_sold: pkg.stock_sold ?? 0,
          })),
        );
        setHighlights(
          (p.highlights || []).map((h) => ({
            _id: uid(),
            title_zh: h.title_zh,
            title_en: h.title_en,
            desc_zh: h.desc_zh || '',
            desc_en: h.desc_en || '',
          })),
        );
        setFaqs(
          (p.faqs || []).map((f) => ({
            _id: uid(),
            question_zh: f.question_zh,
            question_en: f.question_en,
            answer_zh: f.answer_zh,
            answer_en: f.answer_en,
          })),
        );
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [productId]);

  // ─── Form helpers ───
  const updateField = useCallback((field: keyof FormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ─── Build payload ───
  const buildPayload = useCallback(() => {
    return {
      name_zh: form.name_zh,
      name_en: form.name_en,
      summary_zh: form.summary_zh,
      summary_en: form.summary_en,
      description_zh: form.description_zh,
      description_en: form.description_en,
      region_id: form.region_id || undefined,
      category_id: form.category_id || undefined,
      price_from: parseFloat(form.price_from) || 0,
      duration: form.duration,
      group_size: form.group_size,
      address_zh: form.address_zh,
      address_en: form.address_en,
      tags: form.tags,
      images: images.map((img, i) => ({
        url: img.url,
        sort_order: i,
        is_cover: img.is_cover,
      })),
      packages: packages.map((pkg, i) => ({
        name_zh: pkg.name_zh,
        name_en: pkg.name_en,
        desc_zh: pkg.desc_zh,
        desc_en: pkg.desc_en,
        price: pkg.price,
        sort_order: i,
        // REQ-20260509-0035
        stock_total: pkg.stock_total ?? -1,
      })),
      highlights: highlights.map((h, i) => ({
        title_zh: h.title_zh,
        title_en: h.title_en,
        desc_zh: h.desc_zh,
        desc_en: h.desc_en,
        sort_order: i,
      })),
      faqs: faqs.map((f, i) => ({
        question_zh: f.question_zh,
        question_en: f.question_en,
        answer_zh: f.answer_zh,
        answer_en: f.answer_en,
        sort_order: i,
      })),
    };
  }, [form, images, packages, highlights, faqs]);

  // ─── Save draft ───
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEditMode && productId) {
        await supplierProductService.update(Number(productId), payload);
      } else {
        await supplierProductService.create(payload);
      }
      onNavigate?.('/supplier/products');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    }
    setSaving(false);
  };

  // ─── Save & submit ───
  const handleSaveAndSubmit = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      let id = productId ? Number(productId) : 0;
      if (isEditMode && productId) {
        await supplierProductService.update(Number(productId), payload);
      } else {
        const created = await supplierProductService.create(payload);
        id = created.id;
      }
      await supplierProductService.submitForReview(id);
      onNavigate?.('/supplier/products');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Submit failed');
    }
    setSaving(false);
  };

  // ─── Image upload ───
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const [uploadError, setUploadError] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadError('');
    const remaining = 5 - images.length;
    const toUpload = Array.from(files).slice(0, remaining);

    for (const file of toUpload) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError(t('supplier.productForm.uploadErrorFormat', 'Only JPG, PNG, WebP and GIF images are allowed'));
        continue;
      }
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(t('supplier.productForm.uploadErrorSize', 'Image size must be under 10MB'));
        continue;
      }

      const tempId = uid();
      setImages((prev) => [...prev, {
        _id: tempId, url: '', sort_order: prev.length, is_cover: prev.length === 0, _uploading: true,
      }]);
      try {
        const url = await supplierProductService.upload(file);
        setImages((prev) => prev.map((img) =>
          img._id === tempId ? { ...img, url, _uploading: false } : img,
        ));
      } catch (err) {
        setImages((prev) => prev.filter((img) => img._id !== tempId));
        setUploadError(err instanceof Error ? err.message : t('supplier.productForm.uploadErrorGeneral', 'Upload failed, please try again'));
      }
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setImages((prev) => {
      const oldIndex = prev.findIndex((i) => i._id === active.id);
      const newIndex = prev.findIndex((i) => i._id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const next = prev.filter((i) => i._id !== id);
      if (next.length > 0 && !next.some((i) => i.is_cover)) {
        next[0].is_cover = true;
      }
      return next;
    });
  };

  const setCoverImage = (id: string) => {
    setImages((prev) => prev.map((img) => ({ ...img, is_cover: img._id === id })));
  };

  // ─── Package helpers ───
  const addPackage = () => {
    setPackages((prev) => [...prev, {
      _id: uid(), name_zh: '', name_en: '', desc_zh: '', desc_en: '', price: 0,
      // REQ-20260509-0035
      stock_total: -1, stock_sold: 0,
    }]);
  };

  const updatePackage = (id: string, field: keyof PackagePayload, value: string | number) => {
    setPackages((prev) => prev.map((p) =>
      p._id === id ? { ...p, [field]: value } : p,
    ));
  };

  const removePackage = (id: string) => {
    setPackages((prev) => prev.filter((p) => p._id !== id));
  };

  // ─── Highlight helpers ───
  const addHighlight = () => {
    setHighlights((prev) => [...prev, {
      _id: uid(), title_zh: '', title_en: '', desc_zh: '', desc_en: '',
    }]);
  };

  const updateHighlight = (id: string, field: keyof HighlightPayload, value: string) => {
    setHighlights((prev) => prev.map((h) =>
      h._id === id ? { ...h, [field]: value } : h,
    ));
  };

  const removeHighlight = (id: string) => {
    setHighlights((prev) => prev.filter((h) => h._id !== id));
  };

  // ─── FAQ helpers ───
  const addFaq = () => {
    setFaqs((prev) => [...prev, {
      _id: uid(), question_zh: '', question_en: '', answer_zh: '', answer_en: '',
    }]);
  };

  const updateFaq = (id: string, field: keyof FAQPayload, value: string) => {
    setFaqs((prev) => prev.map((f) =>
      f._id === id ? { ...f, [field]: value } : f,
    ));
  };

  const removeFaq = (id: string) => {
    setFaqs((prev) => prev.filter((f) => f._id !== id));
  };

  // ─── Navigation ───
  const goNext = () => setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goPrev = () => setCurrentStep((s) => Math.max(s - 1, 0));
  const goToStep = (i: number) => setCurrentStep(i);

  // ────────────────────────────── Render Steps ──────────────────────────────

  const renderStepBasic = () => (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('supplier.productForm.basicInfo')}</h3>

      {/* AI Writer */}
      <Suspense fallback={null}>
        <ProductAiWriter
          nameZh={form.name_zh}
          onApply={(content: GeneratedContent) => {
            updateField('name_en', content.name_en);
            updateField('description_zh', content.description_zh);
            updateField('description_en', content.description_en);
          }}
        />
      </Suspense>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('supplier.productForm.titleZh')} *</label>
          <input type="text" className={styles.input} value={form.name_zh}
            onChange={(e) => updateField('name_zh', e.target.value)}
            placeholder={t('supplier.productForm.titleZhPlaceholder')} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('supplier.productForm.titleEn')} *</label>
          <input type="text" className={styles.input} value={form.name_en}
            onChange={(e) => updateField('name_en', e.target.value)}
            placeholder={t('supplier.productForm.titleEnPlaceholder')} />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('supplier.productForm.summaryZh')}</label>
          <input type="text" className={styles.input} value={form.summary_zh}
            onChange={(e) => updateField('summary_zh', e.target.value)}
            placeholder={t('supplier.productForm.summaryPlaceholder')} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('supplier.productForm.summaryEn')}</label>
          <input type="text" className={styles.input} value={form.summary_en}
            onChange={(e) => updateField('summary_en', e.target.value)}
            placeholder={t('supplier.productForm.summaryPlaceholder')} />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>{t('supplier.productForm.descriptionZh')}</label>
        <textarea className={styles.textarea} rows={4} value={form.description_zh}
          onChange={(e) => updateField('description_zh', e.target.value)}
          placeholder={t('supplier.productForm.descriptionPlaceholder')} />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>{t('supplier.productForm.descriptionEn')}</label>
        <textarea className={styles.textarea} rows={4} value={form.description_en}
          onChange={(e) => updateField('description_en', e.target.value)}
          placeholder={t('supplier.productForm.descriptionPlaceholder')} />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('supplier.productForm.region')}</label>
          <select className={styles.select} value={form.region_id}
            onChange={(e) => updateField('region_id', Number(e.target.value))}>
            <option value={0}>{t('supplier.productForm.selectRegion')}</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{isZh ? r.name_zh : r.name_en}</option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('supplier.productForm.category')}</label>
          <select className={styles.select} value={form.category_id}
            onChange={(e) => updateField('category_id', Number(e.target.value))}>
            <option value={0}>{t('supplier.productForm.selectCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{isZh ? c.name_zh : c.name_en}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.formRow3}>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('supplier.productForm.price')}</label>
          <input type="number" className={styles.input} value={form.price_from}
            onChange={(e) => updateField('price_from', e.target.value)}
            placeholder={t('supplier.productForm.pricePlaceholder')} min="0" step="0.01" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('supplier.productForm.duration')}</label>
          <input type="text" className={styles.input} value={form.duration}
            onChange={(e) => updateField('duration', e.target.value)}
            placeholder={t('supplier.productForm.durationPlaceholder')} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('supplier.productForm.groupSize')}</label>
          <input type="text" className={styles.input} value={form.group_size}
            onChange={(e) => updateField('group_size', e.target.value)}
            placeholder={t('supplier.productForm.groupSizePlaceholder')} />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('supplier.productForm.addressZh')}</label>
          <input type="text" className={styles.input} value={form.address_zh}
            onChange={(e) => updateField('address_zh', e.target.value)}
            placeholder={t('supplier.productForm.addressPlaceholder')} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('supplier.productForm.addressEn')}</label>
          <input type="text" className={styles.input} value={form.address_en}
            onChange={(e) => updateField('address_en', e.target.value)}
            placeholder={t('supplier.productForm.addressPlaceholder')} />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>{t('supplier.productForm.tags')}</label>
        <input type="text" className={styles.input} value={form.tags}
          onChange={(e) => updateField('tags', e.target.value)}
          placeholder={t('supplier.productForm.tagsHint')} />
        <p className={styles.hint}>{t('supplier.productForm.tagsHint')}</p>
      </div>
    </div>
  );

  const renderStepImages = () => (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>{t('supplier.productForm.imageUpload')}</h3>
        <span className={styles.hint}>
          {images.length}/5 &middot; {t('supplier.productForm.dragToSort')}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleImageDragEnd}>
        <SortableContext items={images.map((i) => i._id)} strategy={horizontalListSortingStrategy}>
          <div className={styles.imageGrid}>
            {images.map((img) => (
              img._uploading ? (
                <div key={img._id} className={styles.uploadCard} style={{ opacity: 0.6 }}>
                  <Upload size={20} />
                  <span>{t('supplier.productForm.uploading')}</span>
                </div>
              ) : (
                <SortableImage
                  key={img._id}
                  item={img}
                  isZh={isZh}
                  onRemove={() => removeImage(img._id)}
                  onSetCover={() => setCoverImage(img._id)}
                />
              )
            ))}

            {images.length < 5 && (
              <div
                className={styles.uploadCard}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={24} />
                <span>{t('supplier.productForm.uploadImage')}</span>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {uploadError && (
        <p style={{ marginTop: '0.75rem', color: '#dc2626', fontSize: '0.875rem' }}>
          {uploadError}
        </p>
      )}
      <p className={styles.hint} style={{ marginTop: '0.75rem' }}>
        {t('supplier.productForm.imageUploadHint')} · JPG/PNG/WebP/GIF · Max 10MB
      </p>
    </div>
  );

  const renderStepPackages = () => (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>{t('supplier.productForm.packages')}</h3>
        <button type="button" className={styles.addBtn} style={{ width: 'auto' }} onClick={addPackage}>
          <Plus size={14} />
          {t('supplier.productForm.addPackage')}
        </button>
      </div>

      {packages.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('supplier.productForm.noPackages')}</p>
          <button type="button" className={styles.addBtn} onClick={addPackage}>
            <Plus size={14} />
            {t('supplier.productForm.addPackage')}
          </button>
        </div>
      ) : (
        packages.map((pkg, i) => (
          <div key={pkg._id} className={styles.listItem}>
            <div className={styles.listItemHeader}>
              <span className={styles.listItemIndex}>#{i + 1}</span>
              <button type="button" className={styles.removeBtn} onClick={() => removePackage(pkg._id)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.productForm.packageNameZh')} *</label>
                <input type="text" className={styles.input} value={pkg.name_zh}
                  onChange={(e) => updatePackage(pkg._id, 'name_zh', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.productForm.packageNameEn')} *</label>
                <input type="text" className={styles.input} value={pkg.name_en}
                  onChange={(e) => updatePackage(pkg._id, 'name_en', e.target.value)} />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.productForm.packageDescZh')}</label>
                <input type="text" className={styles.input} value={pkg.desc_zh}
                  onChange={(e) => updatePackage(pkg._id, 'desc_zh', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.productForm.packageDescEn')}</label>
                <input type="text" className={styles.input} value={pkg.desc_en}
                  onChange={(e) => updatePackage(pkg._id, 'desc_en', e.target.value)} />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ maxWidth: 200 }}>
                <label className={styles.label}>{t('supplier.productForm.packagePrice')} *</label>
                <input type="number" className={styles.input} value={pkg.price || ''}
                  onChange={(e) => updatePackage(pkg._id, 'price', parseFloat(e.target.value) || 0)}
                  min="0" step="0.01" />
              </div>
              {/* REQ-20260509-0035: 库存输入 + 无限量 checkbox + 已售/总只读展示 */}
              <div className={styles.formGroup} style={{ maxWidth: 200 }}>
                <label className={styles.label}>
                  {t('supplier.productForm.packageStock', '库存')}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="number" className={styles.input}
                    style={{ flex: 1 }}
                    value={pkg.stock_total === -1 ? '' : (pkg.stock_total ?? '')}
                    placeholder={t('supplier.productForm.packageStockUnlimited', '无限量') as string}
                    disabled={pkg.stock_total === -1}
                    onChange={(e) => {
                      const v = e.target.value;
                      updatePackage(pkg._id, 'stock_total', v === '' ? -1 : Math.max(0, parseInt(v, 10) || 0));
                    }}
                    min="0" step="1" />
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    <input type="checkbox"
                      checked={pkg.stock_total === -1 || pkg.stock_total === undefined}
                      onChange={(e) => updatePackage(pkg._id, 'stock_total', e.target.checked ? -1 : 0)} />
                    {t('supplier.productForm.packageStockUnlimited', '无限量')}
                  </label>
                </div>
                {pkg.stock_total !== -1 && pkg.stock_total !== undefined && (pkg.stock_sold ?? 0) > 0 && (
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    {t('supplier.productForm.packageStockSold', '已售 {{sold}} / 总 {{total}}', { sold: pkg.stock_sold, total: pkg.stock_total })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderStepExtras = () => (
    <>
      {/* Highlights */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>{t('supplier.productForm.highlights')}</h3>
          <button type="button" className={styles.addBtn} style={{ width: 'auto' }} onClick={addHighlight}>
            <Plus size={14} />
            {t('supplier.productForm.addHighlight')}
          </button>
        </div>

        {highlights.length === 0 ? (
          <div className={styles.emptyState}>
            <p>{t('supplier.productForm.noHighlights')}</p>
          </div>
        ) : (
          highlights.map((h, i) => (
            <div key={h._id} className={styles.listItem}>
              <div className={styles.listItemHeader}>
                <span className={styles.listItemIndex}>#{i + 1}</span>
                <button type="button" className={styles.removeBtn} onClick={() => removeHighlight(h._id)}>
                  <X size={16} />
                </button>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.highlightTitleZh')}</label>
                  <input type="text" className={styles.input} value={h.title_zh}
                    onChange={(e) => updateHighlight(h._id, 'title_zh', e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.highlightTitleEn')}</label>
                  <input type="text" className={styles.input} value={h.title_en}
                    onChange={(e) => updateHighlight(h._id, 'title_en', e.target.value)} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.highlightDescZh')}</label>
                  <input type="text" className={styles.input} value={h.desc_zh}
                    onChange={(e) => updateHighlight(h._id, 'desc_zh', e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.highlightDescEn')}</label>
                  <input type="text" className={styles.input} value={h.desc_en}
                    onChange={(e) => updateHighlight(h._id, 'desc_en', e.target.value)} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAQs */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>{t('supplier.productForm.faqs')}</h3>
          <button type="button" className={styles.addBtn} style={{ width: 'auto' }} onClick={addFaq}>
            <Plus size={14} />
            {t('supplier.productForm.addFaq')}
          </button>
        </div>

        {faqs.length === 0 ? (
          <div className={styles.emptyState}>
            <p>{t('supplier.productForm.noFaqs')}</p>
          </div>
        ) : (
          faqs.map((f, i) => (
            <div key={f._id} className={styles.listItem}>
              <div className={styles.listItemHeader}>
                <span className={styles.listItemIndex}>Q{i + 1}</span>
                <button type="button" className={styles.removeBtn} onClick={() => removeFaq(f._id)}>
                  <X size={16} />
                </button>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.faqQuestionZh')}</label>
                  <input type="text" className={styles.input} value={f.question_zh}
                    onChange={(e) => updateFaq(f._id, 'question_zh', e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.faqQuestionEn')}</label>
                  <input type="text" className={styles.input} value={f.question_en}
                    onChange={(e) => updateFaq(f._id, 'question_en', e.target.value)} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.faqAnswerZh')}</label>
                  <textarea className={styles.textarea} rows={2} value={f.answer_zh}
                    onChange={(e) => updateFaq(f._id, 'answer_zh', e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.faqAnswerEn')}</label>
                  <textarea className={styles.textarea} rows={2} value={f.answer_en}
                    onChange={(e) => updateFaq(f._id, 'answer_en', e.target.value)} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  const renderStepPreview = () => {
    const regionName = regions.find((r) => String(r.id) === String(form.region_id));
    const categoryName = categories.find((c) => String(c.id) === String(form.category_id));

    return (
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('supplier.productForm.preview')}</h3>

        {/* Basic Info */}
        <div className={styles.previewSection}>
          <div className={styles.previewLabel}>{t('supplier.productForm.previewBasic')}</div>
          <div className={styles.previewGrid}>
            <div>
              <div className={styles.previewLabel}>{isZh ? '名称(中)' : 'Name(ZH)'}</div>
              <div className={`${styles.previewValue} ${!form.name_zh ? styles.empty : ''}`}>
                {form.name_zh || t('supplier.productForm.noData')}
              </div>
            </div>
            <div>
              <div className={styles.previewLabel}>{isZh ? '名称(英)' : 'Name(EN)'}</div>
              <div className={`${styles.previewValue} ${!form.name_en ? styles.empty : ''}`}>
                {form.name_en || t('supplier.productForm.noData')}
              </div>
            </div>
            <div>
              <div className={styles.previewLabel}>{t('supplier.productForm.region')}</div>
              <div className={`${styles.previewValue} ${!regionName ? styles.empty : ''}`}>
                {regionName ? (isZh ? regionName.name_zh : regionName.name_en) : t('supplier.productForm.noData')}
              </div>
            </div>
            <div>
              <div className={styles.previewLabel}>{t('supplier.productForm.category')}</div>
              <div className={`${styles.previewValue} ${!categoryName ? styles.empty : ''}`}>
                {categoryName ? (isZh ? categoryName.name_zh : categoryName.name_en) : t('supplier.productForm.noData')}
              </div>
            </div>
            <div>
              <div className={styles.previewLabel}>{t('supplier.productForm.price')}</div>
              <div className={`${styles.previewValue} ${!form.price_from ? styles.empty : ''}`}>
                {form.price_from ? `A$${form.price_from}` : t('supplier.productForm.noData')}
              </div>
            </div>
            <div>
              <div className={styles.previewLabel}>{t('supplier.productForm.duration')}</div>
              <div className={`${styles.previewValue} ${!form.duration ? styles.empty : ''}`}>
                {form.duration || t('supplier.productForm.noData')}
              </div>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className={styles.previewSection}>
          <div className={styles.previewLabel}>{t('supplier.productForm.previewImages')} ({images.length})</div>
          {images.length > 0 ? (
            <div className={styles.previewImages}>
              {images.map((img) => (
                <img key={img._id} src={img.url} alt="" />
              ))}
            </div>
          ) : (
            <div className={`${styles.previewValue} ${styles.empty}`}>{t('supplier.productForm.noData')}</div>
          )}
        </div>

        {/* Packages */}
        <div className={styles.previewSection}>
          <div className={styles.previewLabel}>{t('supplier.productForm.previewPackages')} ({packages.length})</div>
          {packages.length > 0 ? (
            <div className={styles.previewGrid}>
              {packages.map((pkg) => (
                <div key={pkg._id} className={styles.previewItem}>
                  <h4>{isZh ? pkg.name_zh : pkg.name_en}</h4>
                  {(isZh ? pkg.desc_zh : pkg.desc_en) && (
                    <p>{isZh ? pkg.desc_zh : pkg.desc_en}</p>
                  )}
                  <div className={styles.previewPrice}>A${pkg.price}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${styles.previewValue} ${styles.empty}`}>{t('supplier.productForm.noData')}</div>
          )}
        </div>

        {/* Highlights */}
        <div className={styles.previewSection}>
          <div className={styles.previewLabel}>{t('supplier.productForm.previewHighlights')} ({highlights.length})</div>
          {highlights.length > 0 ? (
            <div className={styles.previewGrid}>
              {highlights.map((h) => (
                <div key={h._id} className={styles.previewItem}>
                  <h4>{isZh ? h.title_zh : h.title_en}</h4>
                  {(isZh ? h.desc_zh : h.desc_en) && (
                    <p>{isZh ? h.desc_zh : h.desc_en}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={`${styles.previewValue} ${styles.empty}`}>{t('supplier.productForm.noData')}</div>
          )}
        </div>

        {/* FAQs */}
        <div className={styles.previewSection}>
          <div className={styles.previewLabel}>{t('supplier.productForm.previewFaqs')} ({faqs.length})</div>
          {faqs.length > 0 ? (
            faqs.map((f) => (
              <div key={f._id} className={styles.previewItem} style={{ marginBottom: '0.5rem' }}>
                <h4>Q: {isZh ? f.question_zh : f.question_en}</h4>
                <p>A: {isZh ? f.answer_zh : f.answer_en}</p>
              </div>
            ))
          ) : (
            <div className={`${styles.previewValue} ${styles.empty}`}>{t('supplier.productForm.noData')}</div>
          )}
        </div>
      </div>
    );
  };

  // ────────────────────────────── Main Render ──────────────────────────────

  if (loading) {
    return (
      <div className={styles.loadingOverlay}>{t('supplier.productForm.loadingProduct')}</div>
    );
  }

  return (
    <div className={styles.container}>
          {/* Breadcrumb */}
          <nav className={styles.breadcrumb}>
            <button onClick={() => onNavigate?.('/supplier/products')} className={styles.breadcrumbLink}>
              {t('supplier.products.title')}
            </button>
            <span className={styles.breadcrumbSep}>/</span>
            <span>{isEditMode ? t('supplier.products.edit') : t('supplier.products.addProduct')}</span>
          </nav>

          <h1 className={styles.pageTitle}>
            {isEditMode ? t('supplier.products.edit') : t('supplier.products.addProduct')}
          </h1>

          {/* REQ-20260508-0002: AI-translated Chinese preview, visible after the
              supplier has submitted the product (or while the AI is working). */}
          {isEditMode && productId && productStatus !== 'draft' && (
            <ChinesePreview productId={Number(productId)} />
          )}

          {/* Step Indicator */}
          <div className={styles.stepper}>
            {STEPS.map((key, i) => (
              <React.Fragment key={key}>
                {i > 0 && (
                  <div className={`${styles.stepLine} ${i <= currentStep ? styles.done : ''}`} />
                )}
                <button
                  type="button"
                  className={`${styles.step} ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}
                  onClick={() => goToStep(i)}
                >
                  <span className={styles.stepNumber}>
                    {i < currentStep ? <Check size={14} /> : i + 1}
                  </span>
                  <span className={styles.stepLabel}>
                    {t(`supplier.productForm.steps.${key}`)}
                  </span>
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Step Content */}
          {currentStep === 0 && renderStepBasic()}
          {currentStep === 1 && renderStepImages()}
          {currentStep === 2 && renderStepPackages()}
          {currentStep === 3 && renderStepExtras()}
          {currentStep === 4 && renderStepPreview()}

          {/* Footer Navigation */}
          <div className={styles.footer}>
            <div className={styles.footerLeft}>
              {currentStep > 0 && (
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={goPrev}>
                  <ChevronLeft size={16} />
                  {t('common.prev')}
                </button>
              )}
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => onNavigate?.('/supplier/products')}
              >
                {t('common.cancel')}
              </button>
            </div>

            <div className={styles.footerRight}>
              {/* Save Draft - available on all steps */}
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={handleSaveDraft}
                disabled={saving || (!form.name_zh && !form.name_en)}
              >
                <Save size={16} />
                {saving ? t('supplier.productForm.saving') : t('supplier.productForm.saveDraft')}
              </button>

              {currentStep < STEPS.length - 1 ? (
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={goNext}>
                  {t('common.next')}
                  <ChevronRight size={16} />
                </button>
              ) : (productStatus === 'draft' || productStatus === 'rejected') ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSuccess}`}
                  onClick={handleSaveAndSubmit}
                  disabled={saving || (!form.name_zh && !form.name_en)}
                >
                  <Send size={16} />
                  {saving ? t('supplier.productForm.submitting') : t('supplier.productForm.saveAndSubmit')}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={handleSaveDraft}
                  disabled={saving || (!form.name_zh && !form.name_en)}
                >
                  <Save size={16} />
                  {saving ? t('supplier.productForm.saving') : t('supplier.productForm.saveDraft')}
                </button>
              )}
            </div>
          </div>
    </div>
  );
};

export default SupplierProductFormPage;
