import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check, ChevronLeft, ChevronRight, Plus, X, Image as ImageIcon,
  Star, GripVertical, Upload, Save,
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
import { adminService, type ApiSupplier } from '../../../services/adminService';
import type { ImagePayload, PackagePayload, HighlightPayload, FAQPayload } from '../../../services/supplierProductService';
import { regionService } from '../../../services/regionService';
import type { ApiRegion, ApiCategory } from '../../../services/regionService';
import { EnglishPreview } from '../../../components/Admin/EnglishPreview';
import { ChinesePreview } from '../../../components/Admin/ChinesePreview';
import styles from './AdminProductFormPage.module.css';

// ────────────────────────────── Types ──────────────────────────────

interface ImageItem extends ImagePayload {
  _id: string;
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
  supplier_id: number;
  status: string;
  is_featured: boolean;
}

export interface AdminProductFormPageProps {
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

export const AdminProductFormPage: React.FC<AdminProductFormPageProps> = ({
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
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);

  const [form, setForm] = useState<FormData>({
    name_zh: '', name_en: '',
    summary_zh: '', summary_en: '',
    description_zh: '', description_en: '',
    region_id: 0, category_id: 0,
    price_from: '', duration: '', group_size: '',
    address_zh: '', address_en: '', tags: '',
    supplier_id: 0,
    status: 'approved',
    is_featured: false,
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

  // ─── Load regions, categories & suppliers ───
  useEffect(() => {
    (async () => {
      try {
        const [r, c, s] = await Promise.all([
          regionService.getAllRaw(),
          regionService.getCategoriesRaw(),
          adminService.listSuppliers({ page: 1, page_size: 100, status: 'approved' }),
        ]);
        setRegions(r);
        setCategories(c);
        setSuppliers(s.items || []);
      } catch { /* ignore */ }
    })();
  }, []);

  // ─── Load product in edit mode ───
  useEffect(() => {
    if (!productId) return;
    (async () => {
      setLoading(true);
      try {
        const p = await adminService.getProduct(Number(productId));
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
          supplier_id: p.supplier_id || 0,
          status: p.status || 'approved',
          is_featured: p.is_featured || false,
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
  const updateField = useCallback((field: keyof FormData, value: string | number | boolean) => {
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
      supplier_id: form.supplier_id,
      status: form.status,
      is_featured: form.is_featured,
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

  // ─── Save ───
  const handleSave = async () => {
    if (!form.supplier_id) {
      alert(isZh ? '请选择归属供应商' : 'Please select a supplier');
      return;
    }
    if (!form.region_id || !form.category_id) {
      alert(isZh ? '请选择目的地与分类（无法由 AI 自动填充）' : 'Please select a region and category (these cannot be auto-filled)');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEditMode && productId) {
        await adminService.updateProduct(Number(productId), payload);
      } else {
        await adminService.createProduct(payload);
      }
      onNavigate?.('/admin/products');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    }
    setSaving(false);
  };

  // REQ-20260509-0019: 一站式 "代录 + 上架"。
  // create-only path (not edit), 让 admin 在新建场景下点 "保存并直接上架"
  // 跳过 pending → admin 自审两步。confirm dialog 是人机交互保险——admin
  // 还得显式确认才发请求，防止误触。
  const handleSaveAndPublish = async () => {
    if (!form.supplier_id) {
      alert(isZh ? '请选择归属供应商' : 'Please select a supplier');
      return;
    }
    if (!form.region_id || !form.category_id) {
      alert(isZh ? '请选择目的地与分类（无法由 AI 自动填充）' : 'Please select a region and category (these cannot be auto-filled)');
      return;
    }
    const confirmMsg = isZh
      ? '将跳过审核，代录商品立即上架。确认继续？'
      : 'This will skip review and publish the product immediately. Continue?';
    if (!window.confirm(confirmMsg)) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      await adminService.createProduct(payload, { autoApprove: true });
      onNavigate?.('/admin/products');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    }
    setSaving(false);
  };

  // ─── Image upload ───
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 5 - images.length;
    const toUpload = Array.from(files).slice(0, remaining);

    for (const file of toUpload) {
      const tempId = uid();
      setImages((prev) => [...prev, {
        _id: tempId, url: '', sort_order: prev.length, is_cover: prev.length === 0, _uploading: true,
      }]);
      try {
        const url = await adminService.uploadFile(file);
        setImages((prev) => prev.map((img) =>
          img._id === tempId ? { ...img, url, _uploading: false } : img,
        ));
      } catch {
        setImages((prev) => prev.filter((img) => img._id !== tempId));
      }
    }
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
      <h3 className={styles.sectionTitle}>{t('admin.products.form.basicInfo')}</h3>

      {/* Admin-specific fields */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('admin.products.form.supplier')} *</label>
          <select className={styles.select} value={form.supplier_id}
            onChange={(e) => updateField('supplier_id', Number(e.target.value))}>
            <option value={0}>{t('admin.products.form.selectSupplier')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('admin.products.form.status')}</label>
          <select className={styles.select} value={form.status}
            onChange={(e) => updateField('status', e.target.value)}>
            <option value="draft">{t('admin.products.status.draft')}</option>
            <option value="pending">{t('admin.products.status.pending')}</option>
            <option value="approved">{t('admin.products.status.approved')}</option>
            <option value="rejected">{t('admin.products.status.rejected')}</option>
            <option value="offline">{t('admin.products.status.offline')}</option>
          </select>
        </div>
      </div>

      <div className={styles.checkboxRow}>
        <input
          type="checkbox"
          id="is_featured"
          checked={form.is_featured}
          onChange={(e) => updateField('is_featured', e.target.checked)}
        />
        <label htmlFor="is_featured">{t('admin.products.form.isFeatured')}</label>
      </div>

      {/* Standard fields (same as supplier form) */}
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
        accept="image/*"
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

      <p className={styles.hint} style={{ marginTop: '0.75rem' }}>
        {t('supplier.productForm.imageUploadHint')}
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
            <div className={styles.formGroup} style={{ maxWidth: 200 }}>
              <label className={styles.label}>{t('supplier.productForm.packagePrice')} *</label>
              <input type="number" className={styles.input} value={pkg.price || ''}
                onChange={(e) => updatePackage(pkg._id, 'price', parseFloat(e.target.value) || 0)}
                min="0" step="0.01" />
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
    const supplierName = suppliers.find((s) => String(s.id) === String(form.supplier_id));

    return (
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('supplier.productForm.preview')}</h3>

        {/* Admin-specific info */}
        <div className={styles.previewSection}>
          <div className={styles.previewLabel}>{t('admin.products.form.adminFields')}</div>
          <div className={styles.previewGrid}>
            <div>
              <div className={styles.previewLabel}>{t('admin.products.form.supplier')}</div>
              <div className={`${styles.previewValue} ${!supplierName ? styles.empty : ''}`}>
                {supplierName?.name || t('supplier.productForm.noData')}
              </div>
            </div>
            <div>
              <div className={styles.previewLabel}>{t('admin.products.form.status')}</div>
              <div className={styles.previewValue}>{form.status}</div>
            </div>
            <div>
              <div className={styles.previewLabel}>{t('admin.products.form.isFeatured')}</div>
              <div className={styles.previewValue}>
                {form.is_featured ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No')}
              </div>
            </div>
          </div>
        </div>

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
    return <div className={styles.loadingOverlay}>{t('supplier.productForm.loadingProduct')}</div>;
  }

  return (
    <div className={styles.container}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <button onClick={() => onNavigate?.('/admin/products')} className={styles.breadcrumbLink}>
          {t('admin.products.title')}
        </button>
        <span className={styles.breadcrumbSep}>/</span>
        <span>{isEditMode ? t('admin.products.form.editTitle') : t('admin.products.form.createTitle')}</span>
      </nav>

      <h1 className={styles.pageTitle}>
        {isEditMode ? t('admin.products.form.editTitle') : t('admin.products.form.createTitle')}
      </h1>

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

      {/*
        REQ-20260509-0004 + REQ-20260509-0015: AI translation preview panels,
        bidirectional. EnglishPreview surfaces ZH→EN; ChinesePreview surfaces
        EN→ZH. Both poll independently and either one can be regenerated. The
        backend triggers whichever direction makes sense based on which side
        has blanks at Save time. Sub-tables (highlights / packages / FAQs) are
        not auto-translated — admin must mirror those manually.
      */}
      {isEditMode && productId && (
        <>
          <EnglishPreview productId={Number(productId)} active={true} />
          <ChinesePreview productId={Number(productId)} active={true} />
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: 6,
            color: '#9a3412',
            fontSize: 13,
          }}>
            ⚠️ Highlights / Packages / FAQs are not auto-translated. Edit both ZH
            and EN versions manually for those sub-tables.
          </div>
        </>
      )}

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
            onClick={() => onNavigate?.('/admin/products')}
          >
            {t('common.cancel')}
          </button>
        </div>

        <div className={styles.footerRight}>
          {currentStep < STEPS.length - 1 ? (
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={goNext}>
              {t('common.next')}
              <ChevronRight size={16} />
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSuccess}`}
                onClick={handleSave}
                disabled={saving || (!form.name_zh && !form.name_en) || !form.supplier_id || !form.region_id || !form.category_id}
              >
                <Save size={16} />
                {saving ? t('supplier.productForm.saving') : t('common.save')}
              </button>
              {!isEditMode && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={handleSaveAndPublish}
                  disabled={saving || (!form.name_zh && !form.name_en) || !form.supplier_id || !form.region_id || !form.category_id}
                  title={
                    isZh
                      ? '跳过审核直接上架（仅适用于代录场景）'
                      : 'Skip review and publish immediately (proxy-create only)'
                  }
                >
                  <Save size={16} />
                  {isZh ? '保存并直接上架' : 'Save & Publish Now'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProductFormPage;
