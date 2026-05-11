import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Save, Star, ExternalLink, GripVertical, Eye, Image, Info, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Modal, ConfirmModal, ToastContainer } from '../../../components/Common';
import type { ToastItem } from '../../../components/Common/Toast/Toast';
import {
  homepageAdminService,
  CUSTOM_BLOCK_KEY_PREFIX,
  type HomepageFeature,
  type HomepageTestimonial,
  type HomepagePartner,
  type CustomBlockConfig,
} from '../../../services/homepageService';
import styles from './HomepageCMS.module.css';

// ─── Tab types ───
type TabKey = 'modules' | 'features' | 'testimonials' | 'partners';

// ─── Form data types ───
interface FeatureFormData {
  icon: string;
  title_zh: string;
  title_en: string;
  desc_zh: string;
  desc_en: string;
  sort_order: number;
  status: string;
}

interface TestimonialFormData {
  source: string;
  author_name: string;
  author_avatar: string;
  content_zh: string;
  content_en: string;
  rating: number;
  product_name_zh: string;
  product_name_en: string;
  sort_order: number;
  status: string;
}

interface PartnerFormData {
  name: string;
  logo: string;
  website: string;
  sort_order: number;
  status: string;
}

type CustomBlockFormData = CustomBlockConfig;

// ─── Empty form defaults ───
const emptyFeatureForm: FeatureFormData = {
  icon: '',
  title_zh: '',
  title_en: '',
  desc_zh: '',
  desc_en: '',
  sort_order: 0,
  status: 'active',
};

const emptyTestimonialForm: TestimonialFormData = {
  source: 'manual',
  author_name: '',
  author_avatar: '',
  content_zh: '',
  content_en: '',
  rating: 5,
  product_name_zh: '',
  product_name_en: '',
  sort_order: 0,
  status: 'active',
};

const emptyCustomBlockForm: CustomBlockFormData = {
  title_zh: '',
  title_en: '',
  desc_zh: '',
  desc_en: '',
  image_url: '',
  cta_text_zh: '',
  cta_text_en: '',
  cta_link: '',
};

const emptyPartnerForm: PartnerFormData = {
  name: '',
  logo: '',
  website: '',
  sort_order: 0,
  status: 'active',
};

// ─── Local module edit state ───
interface ModuleEditState {
  id: number;
  module_key: string;
  title_zh: string;
  title_en: string;
  sort_order: number;
  is_visible: boolean;
}

// ─── Validation errors ───
interface ValidationErrors {
  [key: string]: string;
}

// ─── Module descriptions ───
const MODULE_DESCRIPTIONS: Record<string, { zh: string; en: string }> = {
  banner: { zh: '首页轮播横幅图片', en: 'Homepage hero banner carousel' },
  search: { zh: '搜索栏（活动/酒店切换）', en: 'Search bar with activity/hotel tabs' },
  regions: { zh: '地区展示卡片', en: 'Region display cards' },
  featured: { zh: '精选推荐产品', en: 'Featured/recommended products' },
  categories: { zh: '分类浏览入口', en: 'Category browsing section' },
  features: { zh: '"为什么选择我们" 特色亮点', en: '"Why Choose Us" feature highlights' },
  testimonials: { zh: '用户评价展示', en: 'Customer testimonials section' },
  partners: { zh: '合作伙伴 Logo 展示', en: 'Partner logos display' },
  popular: { zh: '热门活动排行（自动按订单量排序）', en: 'Popular activities ranking (auto-sorted by orders)' },
};

// ─── Sortable Module Row ───
function SortableModuleRow({
  mod,
  onFieldChange,
  onDelete,
}: {
  mod: ModuleEditState;
  onFieldChange: (id: number, field: keyof ModuleEditState, value: string | number | boolean) => void;
  onDelete?: (mod: ModuleEditState) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mod.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const desc = MODULE_DESCRIPTIONS[mod.module_key];

  return (
    <tr ref={setNodeRef} style={style}>
      <td>
        <button type="button" className={styles.dragHandle} {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
      </td>
      <td>
        <div className={styles.moduleKeyCell}>
          <span className={styles.moduleKey}>{mod.module_key}</span>
          {desc && (
            <span className={styles.moduleDesc} title={`${desc.zh}\n${desc.en}`}>
              <Info size={13} />
            </span>
          )}
        </div>
      </td>
      <td>
        <input
          type="text"
          className={styles.titleInput}
          value={mod.title_zh}
          onChange={(e) => onFieldChange(mod.id, 'title_zh', e.target.value)}
        />
      </td>
      <td>
        <input
          type="text"
          className={styles.titleInput}
          value={mod.title_en}
          onChange={(e) => onFieldChange(mod.id, 'title_en', e.target.value)}
        />
      </td>
      <td>
        <button
          type="button"
          className={`${styles.switchTrack} ${mod.is_visible ? styles.switchChecked : ''}`}
          onClick={() => onFieldChange(mod.id, 'is_visible', !mod.is_visible)}
          aria-label={mod.is_visible ? 'Disable' : 'Enable'}
        >
          <span className={styles.switchThumb} />
        </button>
      </td>
      <td style={{ width: 48, textAlign: 'center' }}>
        {onDelete && mod.module_key.startsWith(CUSTOM_BLOCK_KEY_PREFIX) && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => onDelete(mod)}
            title="Delete CustomBlock"
            aria-label="Delete CustomBlock"
          >
            <Trash2 size={16} />
          </button>
        )}
      </td>
    </tr>
  );
}

export const HomepageCMS: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ─── Dirty tracking for Modules ───
  const modulesSnapshot = useRef<string>('');

  // ─── DnD sensors ───
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── Toast state ───
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Tab state ───
  const [activeTab, setActiveTab] = useState<TabKey>('modules');

  // ─── Modules state ───
  const [modules, setModules] = useState<ModuleEditState[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesSaving, setModulesSaving] = useState(false);

  // ─── CustomBlock state ───
  const [customBlockFormOpen, setCustomBlockFormOpen] = useState(false);
  const [customBlockForm, setCustomBlockForm] = useState<CustomBlockFormData>(emptyCustomBlockForm);
  const [customBlockSaving, setCustomBlockSaving] = useState(false);
  const [customBlockErrors, setCustomBlockErrors] = useState<ValidationErrors>({});
  const [customBlockDeleteConfirm, setCustomBlockDeleteConfirm] = useState<ModuleEditState | null>(null);

  // ─── Status filter ───
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // ─── Selection state (batch ops) ───
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchDeleteConfirmTab, setBatchDeleteConfirmTab] = useState<TabKey | null>(null);

  // ─── Features state ───
  const [features, setFeatures] = useState<HomepageFeature[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featureFormOpen, setFeatureFormOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<HomepageFeature | null>(null);
  const [featureForm, setFeatureForm] = useState<FeatureFormData>(emptyFeatureForm);
  const [featureSaving, setFeatureSaving] = useState(false);
  const [featureDeleteConfirm, setFeatureDeleteConfirm] = useState<HomepageFeature | null>(null);
  const [featureErrors, setFeatureErrors] = useState<ValidationErrors>({});

  // ─── Testimonials state ───
  const [testimonials, setTestimonials] = useState<HomepageTestimonial[]>([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(false);
  const [testimonialFormOpen, setTestimonialFormOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<HomepageTestimonial | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<TestimonialFormData>(emptyTestimonialForm);
  const [testimonialSaving, setTestimonialSaving] = useState(false);
  const [testimonialDeleteConfirm, setTestimonialDeleteConfirm] = useState<HomepageTestimonial | null>(null);
  const [testimonialErrors, setTestimonialErrors] = useState<ValidationErrors>({});
  const [syncing, setSyncing] = useState(false);

  // ─── Partners state ───
  const [partners, setPartners] = useState<HomepagePartner[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnerFormOpen, setPartnerFormOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<HomepagePartner | null>(null);
  const [partnerForm, setPartnerForm] = useState<PartnerFormData>(emptyPartnerForm);
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [partnerDeleteConfirm, setPartnerDeleteConfirm] = useState<HomepagePartner | null>(null);
  const [partnerErrors, setPartnerErrors] = useState<ValidationErrors>({});

  // ─── Load data on tab change ───
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);

  const loadTabData = async (tab: TabKey) => {
    switch (tab) {
      case 'modules':
        return loadModules();
      case 'features':
        return loadFeatures();
      case 'testimonials':
        return loadTestimonials();
      case 'partners':
        return loadPartners();
    }
  };

  // ════════════════════════════════════════
  // Validation helpers
  // ════════════════════════════════════════
  const validateFeatureForm = (form: FeatureFormData): ValidationErrors => {
    const errors: ValidationErrors = {};
    if (!form.title_zh.trim()) errors.title_zh = t('admin.homepage.validation.required', 'Required');
    if (!form.title_en.trim()) errors.title_en = t('admin.homepage.validation.required', 'Required');
    if (!form.icon.trim()) errors.icon = t('admin.homepage.validation.required', 'Required');
    return errors;
  };

  const validateTestimonialForm = (form: TestimonialFormData): ValidationErrors => {
    const errors: ValidationErrors = {};
    if (!form.author_name.trim()) errors.author_name = t('admin.homepage.validation.required', 'Required');
    if (!form.content_zh.trim() && !form.content_en.trim()) {
      errors.content_zh = t('admin.homepage.validation.contentRequired', 'At least one language required');
    }
    return errors;
  };

  const validatePartnerForm = (form: PartnerFormData): ValidationErrors => {
    const errors: ValidationErrors = {};
    if (!form.name.trim()) errors.name = t('admin.homepage.validation.required', 'Required');
    return errors;
  };

  const validateCustomBlockForm = (form: CustomBlockFormData): ValidationErrors => {
    const errors: ValidationErrors = {};
    if (!form.title_zh.trim()) errors.title_zh = t('admin.homepage.validation.required', 'Required');
    if (!form.title_en.trim()) errors.title_en = t('admin.homepage.validation.required', 'Required');
    if (form.cta_link && form.cta_link.trim()) {
      const link = form.cta_link.trim();
      if (!link.startsWith('http://') && !link.startsWith('https://') && !link.startsWith('/')) {
        errors.cta_link = t('admin.homepage.validation.urlScheme', 'Must start with http(s):// or /');
      }
    }
    return errors;
  };

  // ════════════════════════════════════════
  // CustomBlock create / delete
  // ════════════════════════════════════════
  const openCustomBlockForm = () => {
    setCustomBlockForm(emptyCustomBlockForm);
    setCustomBlockErrors({});
    setCustomBlockFormOpen(true);
  };

  const handleCustomBlockSubmit = async () => {
    const errors = validateCustomBlockForm(customBlockForm);
    if (Object.keys(errors).length > 0) {
      setCustomBlockErrors(errors);
      return;
    }
    setCustomBlockSaving(true);
    try {
      const existingCustomBlocks = modules.filter((m) => m.module_key.startsWith(CUSTOM_BLOCK_KEY_PREFIX));
      const maxSort = existingCustomBlocks.reduce((acc, m) => Math.max(acc, m.sort_order), 9000);
      await homepageAdminService.createCustomBlock({
        title_zh: customBlockForm.title_zh.trim(),
        title_en: customBlockForm.title_en.trim(),
        config: customBlockForm,
        sort_order: maxSort + 10,
        is_visible: true,
      });
      addToast('success', t('admin.homepage.customBlockCreated', 'CustomBlock created'));
      setCustomBlockFormOpen(false);
      await loadModules();
    } catch (e) {
      const err = e as { message?: string };
      addToast('error', err?.message || t('common.error', 'Error'));
    } finally {
      setCustomBlockSaving(false);
    }
  };

  const handleDeleteCustomBlock = async () => {
    if (!customBlockDeleteConfirm) return;
    try {
      await homepageAdminService.deleteModule(customBlockDeleteConfirm.module_key);
      addToast('success', t('admin.homepage.customBlockDeleted', 'CustomBlock deleted'));
      setCustomBlockDeleteConfirm(null);
      await loadModules();
    } catch (e) {
      const err = e as { message?: string };
      addToast('error', err?.message || t('common.error', 'Error'));
    }
  };

  // ════════════════════════════════════════
  // Modules
  // ════════════════════════════════════════
  const loadModules = async () => {
    setModulesLoading(true);
    try {
      const result = await homepageAdminService.listModules();
      const mapped = (result || []).map((m) => ({
        id: m.id,
        module_key: m.module_key,
        title_zh: m.title_zh,
        title_en: m.title_en,
        sort_order: m.sort_order,
        is_visible: m.is_visible,
      }));
      setModules(mapped);
      modulesSnapshot.current = JSON.stringify(mapped);
    } catch {
      addToast('error', t('admin.homepage.loadFailed', 'Failed to load data'));
    }
    setModulesLoading(false);
  };

  const handleModuleFieldChange = (id: number, field: keyof ModuleEditState, value: string | number | boolean) => {
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleModuleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setModules((prev) => {
      const oldIndex = prev.findIndex((m) => m.id === active.id);
      const newIndex = prev.findIndex((m) => m.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      return reordered.map((m, i) => ({ ...m, sort_order: i + 1 }));
    });
  };

  const handleSaveModules = async () => {
    setModulesSaving(true);
    try {
      const payload = modules.map((m) => ({
        id: m.id,
        title_zh: m.title_zh,
        title_en: m.title_en,
        sort_order: m.sort_order,
        is_visible: m.is_visible,
      }));
      const updated = await homepageAdminService.updateModules(payload);
      const mapped = (updated || []).map((m) => ({
        id: m.id,
        module_key: m.module_key,
        title_zh: m.title_zh,
        title_en: m.title_en,
        sort_order: m.sort_order,
        is_visible: m.is_visible,
      }));
      setModules(mapped);
      modulesSnapshot.current = JSON.stringify(mapped);
      addToast('success', t('admin.homepage.saveSuccess', 'Saved successfully'));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.saveFailed', 'Save failed'));
    }
    setModulesSaving(false);
  };

  // ════════════════════════════════════════
  // Features
  // ════════════════════════════════════════
  const loadFeatures = async () => {
    setFeaturesLoading(true);
    try {
      const result = await homepageAdminService.listFeatures();
      setFeatures(result || []);
    } catch {
      addToast('error', t('admin.homepage.loadFailed', 'Failed to load data'));
    }
    setFeaturesLoading(false);
  };

  const handleAddFeature = () => {
    setEditingFeature(null);
    setFeatureForm(emptyFeatureForm);
    setFeatureErrors({});
    setFeatureFormOpen(true);
  };

  const handleEditFeature = (item: HomepageFeature) => {
    setEditingFeature(item);
    setFeatureForm({
      icon: item.icon,
      title_zh: item.title_zh,
      title_en: item.title_en,
      desc_zh: item.desc_zh,
      desc_en: item.desc_en,
      sort_order: item.sort_order,
      status: item.status,
    });
    setFeatureErrors({});
    setFeatureFormOpen(true);
  };

  const handleFeatureSubmit = async () => {
    const errors = validateFeatureForm(featureForm);
    if (Object.keys(errors).length > 0) {
      setFeatureErrors(errors);
      return;
    }
    setFeatureSaving(true);
    try {
      if (editingFeature) {
        const updated = await homepageAdminService.updateFeature(editingFeature.id, featureForm);
        setFeatures((prev) => prev.map((f) => (f.id === editingFeature.id ? updated : f)));
        addToast('success', t('admin.homepage.updateSuccess', 'Updated successfully'));
      } else {
        const created = await homepageAdminService.createFeature(featureForm as Omit<HomepageFeature, 'id'>);
        setFeatures((prev) => [...prev, created]);
        addToast('success', t('admin.homepage.createSuccess', 'Created successfully'));
      }
      setFeatureFormOpen(false);
      setEditingFeature(null);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.operationFailed', 'Operation failed'));
    }
    setFeatureSaving(false);
  };

  const handleDeleteFeature = async () => {
    if (!featureDeleteConfirm) return;
    try {
      await homepageAdminService.deleteFeature(featureDeleteConfirm.id);
      setFeatures((prev) => prev.filter((f) => f.id !== featureDeleteConfirm.id));
      addToast('success', t('admin.homepage.deleteSuccess', 'Deleted successfully'));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.deleteFailed', 'Delete failed'));
    }
    setFeatureDeleteConfirm(null);
  };

  // ════════════════════════════════════════
  // Testimonials
  // ════════════════════════════════════════
  const loadTestimonials = async () => {
    setTestimonialsLoading(true);
    try {
      const result = await homepageAdminService.listTestimonials();
      setTestimonials(result || []);
    } catch {
      addToast('error', t('admin.homepage.loadFailed', 'Failed to load data'));
    }
    setTestimonialsLoading(false);
  };

  const handleSyncTestimonials = async () => {
    setSyncing(true);
    try {
      const result = await homepageAdminService.syncTestimonials();
      addToast('success', t('admin.homepage.syncSuccess', `Synced ${result.synced} reviews`));
      await loadTestimonials();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.syncFailed', 'Sync failed'));
    }
    setSyncing(false);
  };

  const handleAddTestimonial = () => {
    setEditingTestimonial(null);
    setTestimonialForm(emptyTestimonialForm);
    setTestimonialErrors({});
    setTestimonialFormOpen(true);
  };

  const handleEditTestimonial = (item: HomepageTestimonial) => {
    setEditingTestimonial(item);
    setTestimonialForm({
      source: item.source,
      author_name: item.author_name,
      author_avatar: item.author_avatar,
      content_zh: item.content_zh,
      content_en: item.content_en,
      rating: item.rating,
      product_name_zh: item.product_name_zh,
      product_name_en: item.product_name_en,
      sort_order: item.sort_order,
      status: item.status,
    });
    setTestimonialErrors({});
    setTestimonialFormOpen(true);
  };

  const handleTestimonialSubmit = async () => {
    const errors = validateTestimonialForm(testimonialForm);
    if (Object.keys(errors).length > 0) {
      setTestimonialErrors(errors);
      return;
    }
    setTestimonialSaving(true);
    try {
      if (editingTestimonial) {
        const updated = await homepageAdminService.updateTestimonial(editingTestimonial.id, testimonialForm);
        setTestimonials((prev) => prev.map((t) => (t.id === editingTestimonial.id ? updated : t)));
        addToast('success', t('admin.homepage.updateSuccess', 'Updated successfully'));
      } else {
        const created = await homepageAdminService.createTestimonial(
          testimonialForm as Omit<HomepageTestimonial, 'id'>
        );
        setTestimonials((prev) => [...prev, created]);
        addToast('success', t('admin.homepage.createSuccess', 'Created successfully'));
      }
      setTestimonialFormOpen(false);
      setEditingTestimonial(null);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.operationFailed', 'Operation failed'));
    }
    setTestimonialSaving(false);
  };

  const handleDeleteTestimonial = async () => {
    if (!testimonialDeleteConfirm) return;
    try {
      await homepageAdminService.deleteTestimonial(testimonialDeleteConfirm.id);
      setTestimonials((prev) => prev.filter((t) => t.id !== testimonialDeleteConfirm.id));
      addToast('success', t('admin.homepage.deleteSuccess', 'Deleted successfully'));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.deleteFailed', 'Delete failed'));
    }
    setTestimonialDeleteConfirm(null);
  };

  // ════════════════════════════════════════
  // Partners
  // ════════════════════════════════════════
  const loadPartners = async () => {
    setPartnersLoading(true);
    try {
      const result = await homepageAdminService.listPartners();
      setPartners(result || []);
    } catch {
      addToast('error', t('admin.homepage.loadFailed', 'Failed to load data'));
    }
    setPartnersLoading(false);
  };

  const handleAddPartner = () => {
    setEditingPartner(null);
    setPartnerForm(emptyPartnerForm);
    setPartnerErrors({});
    setPartnerFormOpen(true);
  };

  const handleEditPartner = (item: HomepagePartner) => {
    setEditingPartner(item);
    setPartnerForm({
      name: item.name,
      logo: item.logo,
      website: item.website,
      sort_order: item.sort_order,
      status: item.status,
    });
    setPartnerErrors({});
    setPartnerFormOpen(true);
  };

  const handlePartnerSubmit = async () => {
    const errors = validatePartnerForm(partnerForm);
    if (Object.keys(errors).length > 0) {
      setPartnerErrors(errors);
      return;
    }
    setPartnerSaving(true);
    try {
      if (editingPartner) {
        const updated = await homepageAdminService.updatePartner(editingPartner.id, partnerForm);
        setPartners((prev) => prev.map((p) => (p.id === editingPartner.id ? updated : p)));
        addToast('success', t('admin.homepage.updateSuccess', 'Updated successfully'));
      } else {
        const created = await homepageAdminService.createPartner(partnerForm as Omit<HomepagePartner, 'id'>);
        setPartners((prev) => [...prev, created]);
        addToast('success', t('admin.homepage.createSuccess', 'Created successfully'));
      }
      setPartnerFormOpen(false);
      setEditingPartner(null);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.operationFailed', 'Operation failed'));
    }
    setPartnerSaving(false);
  };

  const handleDeletePartner = async () => {
    if (!partnerDeleteConfirm) return;
    try {
      await homepageAdminService.deletePartner(partnerDeleteConfirm.id);
      setPartners((prev) => prev.filter((p) => p.id !== partnerDeleteConfirm.id));
      addToast('success', t('admin.homepage.deleteSuccess', 'Deleted successfully'));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.deleteFailed', 'Delete failed'));
    }
    setPartnerDeleteConfirm(null);
  };

  // ════════════════════════════════════════
  // Inline status toggle
  // ════════════════════════════════════════
  const handleToggleFeatureStatus = async (item: HomepageFeature) => {
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await homepageAdminService.updateFeature(item.id, { status: newStatus });
      setFeatures((prev) => prev.map((f) => (f.id === item.id ? updated : f)));
      addToast('success', t('admin.homepage.statusToggled', 'Status updated'));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.operationFailed', 'Operation failed'));
    }
  };

  const handleToggleTestimonialStatus = async (item: HomepageTestimonial) => {
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await homepageAdminService.updateTestimonial(item.id, { status: newStatus });
      setTestimonials((prev) => prev.map((t) => (t.id === item.id ? updated : t)));
      addToast('success', t('admin.homepage.statusToggled', 'Status updated'));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.operationFailed', 'Operation failed'));
    }
  };

  const handleTogglePartnerStatus = async (item: HomepagePartner) => {
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await homepageAdminService.updatePartner(item.id, { status: newStatus });
      setPartners((prev) => prev.map((p) => (p.id === item.id ? updated : p)));
      addToast('success', t('admin.homepage.statusToggled', 'Status updated'));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.operationFailed', 'Operation failed'));
    }
  };

  // ════════════════════════════════════════
  // Filtered data
  // ════════════════════════════════════════
  const filterByStatus = <T extends { status: string }>(items: T[]): T[] => {
    if (statusFilter === 'all') return items;
    return items.filter((item) => item.status === statusFilter);
  };

  const filteredFeatures = filterByStatus(features);
  const filteredTestimonials = filterByStatus(testimonials);
  const filteredPartners = filterByStatus(partners);

  // ════════════════════════════════════════
  // Selection & Batch operations
  // ════════════════════════════════════════
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: number[]) => {
    const allSelected = ids.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ids));
    }
  };

  const handleBatchToggleStatus = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      if (activeTab === 'features') {
        for (const id of ids) {
          const item = features.find((f) => f.id === id);
          if (item) {
            const newStatus = item.status === 'active' ? 'inactive' : 'active';
            const updated = await homepageAdminService.updateFeature(id, { status: newStatus });
            setFeatures((prev) => prev.map((f) => (f.id === id ? updated : f)));
          }
        }
      } else if (activeTab === 'testimonials') {
        for (const id of ids) {
          const item = testimonials.find((t) => t.id === id);
          if (item) {
            const newStatus = item.status === 'active' ? 'inactive' : 'active';
            const updated = await homepageAdminService.updateTestimonial(id, { status: newStatus });
            setTestimonials((prev) => prev.map((t) => (t.id === id ? updated : t)));
          }
        }
      } else if (activeTab === 'partners') {
        for (const id of ids) {
          const item = partners.find((p) => p.id === id);
          if (item) {
            const newStatus = item.status === 'active' ? 'inactive' : 'active';
            const updated = await homepageAdminService.updatePartner(id, { status: newStatus });
            setPartners((prev) => prev.map((p) => (p.id === id ? updated : p)));
          }
        }
      }
      addToast('success', t('admin.homepage.batchStatusSuccess', `Updated ${ids.length} items`));
      setSelectedIds(new Set());
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.operationFailed', 'Operation failed'));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      if (activeTab === 'features') {
        for (const id of ids) await homepageAdminService.deleteFeature(id);
        setFeatures((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      } else if (activeTab === 'testimonials') {
        for (const id of ids) await homepageAdminService.deleteTestimonial(id);
        setTestimonials((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      } else if (activeTab === 'partners') {
        for (const id of ids) await homepageAdminService.deletePartner(id);
        setPartners((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      }
      addToast('success', t('admin.homepage.batchDeleteSuccess', `Deleted ${ids.length} items`));
      setSelectedIds(new Set());
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('admin.homepage.deleteFailed', 'Delete failed'));
    }
    setBatchDeleteConfirmTab(null);
  };

  // ════════════════════════════════════════
  // Render helpers
  // ════════════════════════════════════════
  const renderStatusFilter = () => (
    <select
      className={styles.statusFilter}
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
    >
      <option value="all">{t('admin.homepage.filterAll', 'All Status')}</option>
      <option value="active">{t('admin.homepage.active', 'Active')}</option>
      <option value="inactive">{t('admin.homepage.inactive', 'Inactive')}</option>
    </select>
  );

  const renderBatchBar = () => {
    if (selectedIds.size === 0) return null;
    return (
      <div className={styles.batchBar}>
        <span className={styles.batchCount}>
          {t('admin.homepage.selectedCount', `${selectedIds.size} selected`, { count: selectedIds.size })}
        </span>
        <button className={styles.batchBtn} onClick={handleBatchToggleStatus}>
          {t('admin.homepage.batchToggleStatus', 'Toggle Status')}
        </button>
        <button
          className={`${styles.batchBtn} ${styles.batchBtnDanger}`}
          onClick={() => setBatchDeleteConfirmTab(activeTab)}
        >
          {t('admin.homepage.batchDelete', 'Delete Selected')}
        </button>
        <button
          className={styles.batchBtnClear}
          onClick={() => setSelectedIds(new Set())}
        >
          {t('admin.homepage.clearSelection', 'Clear')}
        </button>
      </div>
    );
  };

  const renderSelectCheckbox = (id: number) => (
    <input
      type="checkbox"
      className={styles.checkbox}
      checked={selectedIds.has(id)}
      onChange={() => toggleSelect(id)}
    />
  );

  const renderSelectAllCheckbox = (ids: number[]) => (
    <input
      type="checkbox"
      className={styles.checkbox}
      checked={ids.length > 0 && ids.every((id) => selectedIds.has(id))}
      onChange={() => toggleSelectAll(ids)}
    />
  );

  const renderStars = (rating: number) => (
    <div className={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? styles.starFilled : styles.starEmpty}
          fill={n <= rating ? 'currentColor' : 'none'}
        />
      ))}
    </div>
  );

  const renderStarRating = (value: number, onChange: (v: number) => void) => (
    <div className={styles.starRating}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`${styles.starBtn} ${n <= value ? styles.starBtnActive : ''}`}
          onClick={() => onChange(n)}
        >
          <Star size={20} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );

  const renderFieldError = (errors: ValidationErrors, field: string) => {
    if (!errors[field]) return null;
    return <span className={styles.fieldError}>{errors[field]}</span>;
  };

  const renderImagePreview = (url: string, alt: string) => {
    if (!url) return null;
    return (
      <div className={styles.imagePreviewWrapper}>
        <img
          src={url}
          alt={alt}
          className={styles.imagePreview}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    );
  };

  // ════════════════════════════════════════
  // Tab: Modules
  // ════════════════════════════════════════
  const renderModulesTab = () => (
    <>
      <div className={styles.toolbar}>
        <button className={styles.iconBtn} onClick={loadModules} title={t('common.refresh', 'Refresh')}>
          <RefreshCw size={18} />
        </button>
        <button className={styles.addBtn} onClick={openCustomBlockForm}>
          <Plus size={16} />
          {t('admin.homepage.addCustomBlock', '新增 CustomBlock')}
        </button>
        <span className={styles.toolbarHint}>
          {t(
            'admin.homepage.customBlockPositionHint',
            'CustomBlock 固定显示在首页 partners 之后；sort_order 仅控制多个 CustomBlock 之间的相对顺序',
          )}
        </span>
      </div>
      <div className={styles.tableWrapper}>
        {modulesLoading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : modules.length === 0 ? (
          <div className={styles.emptyState}>{t('admin.homepage.noModules', 'No modules found')}</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
            <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>{t('admin.homepage.moduleKey', 'Key')}</th>
                    <th>{t('admin.homepage.titleZh', 'Title (ZH)')}</th>
                    <th>{t('admin.homepage.titleEn', 'Title (EN)')}</th>
                    <th>{t('admin.homepage.visible', 'Visible')}</th>
                    <th style={{ width: 48 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod) => (
                    <SortableModuleRow
                      key={mod.id}
                      mod={mod}
                      onFieldChange={handleModuleFieldChange}
                      onDelete={setCustomBlockDeleteConfirm}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        )}
      </div>
      {modules.length > 0 && (
        <div className={styles.saveBar}>
          {JSON.stringify(modules) !== modulesSnapshot.current && (
            <span className={styles.unsavedHint}>
              {t('admin.homepage.unsavedChanges', 'Unsaved changes')}
            </span>
          )}
          <button
            className={styles.saveBtn}
            onClick={handleSaveModules}
            disabled={modulesSaving}
          >
            <Save size={16} />
            {modulesSaving
              ? t('common.saving', 'Saving...')
              : t('admin.homepage.saveAll', 'Save All')}
          </button>
        </div>
      )}

      {/* CustomBlock Create Modal */}
      <Modal
        open={customBlockFormOpen}
        title={t('admin.homepage.addCustomBlock', '新增 CustomBlock')}
        titleEn="Add Custom Block"
        size="lg"
        confirmLoading={customBlockSaving}
        onClose={() => setCustomBlockFormOpen(false)}
        onOk={handleCustomBlockSubmit}
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.titleZh', '中文标题')} <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={customBlockForm.title_zh}
                onChange={(e) => { setCustomBlockForm((p) => ({ ...p, title_zh: e.target.value })); setCustomBlockErrors((p) => ({ ...p, title_zh: '' })); }}
                className={customBlockErrors.title_zh ? styles.inputError : ''}
              />
              {renderFieldError(customBlockErrors, 'title_zh')}
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.titleEn', '英文标题')} <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={customBlockForm.title_en}
                onChange={(e) => { setCustomBlockForm((p) => ({ ...p, title_en: e.target.value })); setCustomBlockErrors((p) => ({ ...p, title_en: '' })); }}
                className={customBlockErrors.title_en ? styles.inputError : ''}
              />
              {renderFieldError(customBlockErrors, 'title_en')}
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.descZh', '中文描述')}</label>
              <textarea
                value={customBlockForm.desc_zh}
                onChange={(e) => setCustomBlockForm((p) => ({ ...p, desc_zh: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.descEn', '英文描述')}</label>
              <textarea
                value={customBlockForm.desc_en}
                onChange={(e) => setCustomBlockForm((p) => ({ ...p, desc_en: e.target.value }))}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.homepage.field.imageUrl', '图片 URL')}</label>
              <input
                type="text"
                value={customBlockForm.image_url}
                onChange={(e) => setCustomBlockForm((p) => ({ ...p, image_url: e.target.value }))}
                placeholder="/uploads/2026/.../xxx.jpg"
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.ctaTextZh', '按钮中文')}</label>
              <input
                type="text"
                value={customBlockForm.cta_text_zh}
                onChange={(e) => setCustomBlockForm((p) => ({ ...p, cta_text_zh: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.ctaTextEn', '按钮英文')}</label>
              <input
                type="text"
                value={customBlockForm.cta_text_en}
                onChange={(e) => setCustomBlockForm((p) => ({ ...p, cta_text_en: e.target.value }))}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.homepage.field.ctaLink', '跳转链接')}</label>
              <input
                type="text"
                value={customBlockForm.cta_link}
                onChange={(e) => { setCustomBlockForm((p) => ({ ...p, cta_link: e.target.value })); setCustomBlockErrors((p) => ({ ...p, cta_link: '' })); }}
                placeholder="https://... 或 /products/123"
                className={customBlockErrors.cta_link ? styles.inputError : ''}
              />
              {renderFieldError(customBlockErrors, 'cta_link')}
            </div>
          </div>
        </div>
      </Modal>

      {/* CustomBlock Delete Confirm */}
      <ConfirmModal
        open={!!customBlockDeleteConfirm}
        type="danger"
        title={t('admin.homepage.deleteCustomBlockTitle', '删除 CustomBlock')}
        titleEn="Delete Custom Block"
        message={t(
          'admin.homepage.deleteCustomBlockConfirm',
          `确定删除 "${customBlockDeleteConfirm?.title_zh}" 吗？此操作不可撤销。`,
        )}
        messageEn={`Delete "${customBlockDeleteConfirm?.title_en}"? This cannot be undone.`}
        onConfirm={handleDeleteCustomBlock}
        onCancel={() => setCustomBlockDeleteConfirm(null)}
      />
    </>
  );

  // ════════════════════════════════════════
  // Tab: Features
  // ════════════════════════════════════════
  const renderFeaturesTab = () => (
    <>
      <div className={styles.toolbar}>
        {renderStatusFilter()}
        <button className={styles.iconBtn} onClick={loadFeatures} title={t('common.refresh', 'Refresh')}>
          <RefreshCw size={18} />
        </button>
        <button className={styles.addBtn} onClick={handleAddFeature}>
          <Plus size={18} />
          {t('admin.homepage.addFeature', 'Add Feature')}
        </button>
      </div>
      {renderBatchBar()}
      <div className={styles.tableWrapper}>
        {featuresLoading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : filteredFeatures.length === 0 ? (
          <div className={styles.emptyState}>
            {features.length === 0
              ? t('admin.homepage.noFeatures', 'No features yet')
              : t('admin.homepage.noFilterResults', 'No items match the filter')}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>{renderSelectAllCheckbox(filteredFeatures.map((f) => f.id))}</th>
                <th>{t('admin.homepage.icon', 'Icon')}</th>
                <th>{t('admin.homepage.titleZh', 'Title (ZH)')}</th>
                <th>{t('admin.homepage.titleEn', 'Title (EN)')}</th>
                <th>{t('admin.homepage.descZh', 'Desc (ZH)')}</th>
                <th>{t('admin.homepage.descEn', 'Desc (EN)')}</th>
                <th>{t('admin.homepage.sortOrder', 'Sort')}</th>
                <th>{t('admin.homepage.status', 'Status')}</th>
                <th>{t('admin.homepage.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredFeatures.map((item) => (
                <tr key={item.id} className={selectedIds.has(item.id) ? styles.rowSelected : ''}>
                  <td>{renderSelectCheckbox(item.id)}</td>
                  <td>{item.icon}</td>
                  <td>{item.title_zh}</td>
                  <td>{item.title_en}</td>
                  <td>
                    <span className={styles.truncated} title={item.desc_zh}>
                      {item.desc_zh}
                    </span>
                  </td>
                  <td>
                    <span className={styles.truncated} title={item.desc_en}>
                      {item.desc_en}
                    </span>
                  </td>
                  <td>{item.sort_order}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${item.status === 'active' ? styles.statusActive : styles.statusInactive}`}
                      onClick={() => handleToggleFeatureStatus(item)}
                      title={t('admin.homepage.clickToToggle', 'Click to toggle status')}
                    >
                      {item.status === 'active' ? t('admin.homepage.active', 'Active') : t('admin.homepage.inactive', 'Inactive')}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => handleEditFeature(item)}>
                        {t('common.edit', 'Edit')}
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        onClick={() => setFeatureDeleteConfirm(item)}
                      >
                        {t('common.delete', 'Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Feature Form Modal */}
      <Modal
        open={featureFormOpen}
        title={editingFeature
          ? t('admin.homepage.editFeature', '编辑特色')
          : t('admin.homepage.addFeature', '添加特色')}
        titleEn={editingFeature ? 'Edit Feature' : 'Add Feature'}
        size="lg"
        confirmLoading={featureSaving}
        onClose={() => { setFeatureFormOpen(false); setEditingFeature(null); }}
        onOk={handleFeatureSubmit}
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.homepage.field.icon', 'Icon (emoji or class)')} <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={featureForm.icon}
                onChange={(e) => { setFeatureForm((p) => ({ ...p, icon: e.target.value })); setFeatureErrors((p) => ({ ...p, icon: '' })); }}
                placeholder="e.g. shield-check"
                className={featureErrors.icon ? styles.inputError : ''}
              />
              {renderFieldError(featureErrors, 'icon')}
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.titleZh', 'Title (ZH)')} <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={featureForm.title_zh}
                onChange={(e) => { setFeatureForm((p) => ({ ...p, title_zh: e.target.value })); setFeatureErrors((p) => ({ ...p, title_zh: '' })); }}
                className={featureErrors.title_zh ? styles.inputError : ''}
              />
              {renderFieldError(featureErrors, 'title_zh')}
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.titleEn', 'Title (EN)')} <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={featureForm.title_en}
                onChange={(e) => { setFeatureForm((p) => ({ ...p, title_en: e.target.value })); setFeatureErrors((p) => ({ ...p, title_en: '' })); }}
                className={featureErrors.title_en ? styles.inputError : ''}
              />
              {renderFieldError(featureErrors, 'title_en')}
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.descZh', 'Description (ZH)')}</label>
              <textarea
                value={featureForm.desc_zh}
                onChange={(e) => setFeatureForm((p) => ({ ...p, desc_zh: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.descEn', 'Description (EN)')}</label>
              <textarea
                value={featureForm.desc_en}
                onChange={(e) => setFeatureForm((p) => ({ ...p, desc_en: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.sortOrder', 'Sort Order')}</label>
              <input
                type="number"
                value={featureForm.sort_order}
                onChange={(e) => setFeatureForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                min={0}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.status', 'Status')}</label>
              <select
                value={featureForm.status}
                onChange={(e) => setFeatureForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="active">{t('admin.homepage.active', 'Active')}</option>
                <option value="inactive">{t('admin.homepage.inactive', 'Inactive')}</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Feature Delete Confirm */}
      <ConfirmModal
        open={!!featureDeleteConfirm}
        type="danger"
        title={t('admin.homepage.deleteFeatureTitle', '删除特色')}
        titleEn="Delete Feature"
        message={t(
          'admin.homepage.deleteFeatureConfirm',
          `确定要删除特色 "${featureDeleteConfirm?.title_zh}" 吗？此操作不可撤销。`
        )}
        messageEn={`Are you sure you want to delete feature "${featureDeleteConfirm?.title_en}"? This action cannot be undone.`}
        onConfirm={handleDeleteFeature}
        onCancel={() => setFeatureDeleteConfirm(null)}
      />
    </>
  );

  // ════════════════════════════════════════
  // Tab: Testimonials
  // ════════════════════════════════════════
  const renderTestimonialsTab = () => (
    <>
      <div className={styles.toolbar}>
        {renderStatusFilter()}
        <button
          className={styles.syncBtn}
          onClick={handleSyncTestimonials}
          disabled={syncing}
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing
            ? t('admin.homepage.syncing', 'Syncing...')
            : t('admin.homepage.syncReviews', 'Sync Reviews')}
        </button>
        <button className={styles.iconBtn} onClick={loadTestimonials} title={t('common.refresh', 'Refresh')}>
          <RefreshCw size={18} />
        </button>
        <button className={styles.addBtn} onClick={handleAddTestimonial}>
          <Plus size={18} />
          {t('admin.homepage.addTestimonial', 'Add Testimonial')}
        </button>
      </div>
      {renderBatchBar()}
      <div className={styles.tableWrapper}>
        {testimonialsLoading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : filteredTestimonials.length === 0 ? (
          <div className={styles.emptyState}>
            {testimonials.length === 0
              ? t('admin.homepage.noTestimonials', 'No testimonials yet')
              : t('admin.homepage.noFilterResults', 'No items match the filter')}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>{renderSelectAllCheckbox(filteredTestimonials.map((t) => t.id))}</th>
                <th>{t('admin.homepage.author', 'Author')}</th>
                <th>{t('admin.homepage.content', 'Content')}</th>
                <th>{t('admin.homepage.rating', 'Rating')}</th>
                <th>{t('admin.homepage.source', 'Source')}</th>
                <th>{t('admin.homepage.product', 'Product')}</th>
                <th>{t('admin.homepage.status', 'Status')}</th>
                <th>{t('admin.homepage.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTestimonials.map((item) => (
                <tr key={item.id} className={selectedIds.has(item.id) ? styles.rowSelected : ''}>
                  <td>{renderSelectCheckbox(item.id)}</td>
                  <td>
                    <div className={styles.authorCell}>
                      {item.author_avatar ? (
                        <img src={item.author_avatar} alt={item.author_name} className={styles.avatarSmall} />
                      ) : (
                        <div className={styles.avatarPlaceholder}>
                          {item.author_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{item.author_name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={styles.truncated} title={item.content_zh || item.content_en}>
                      {(item.content_zh || item.content_en || '').slice(0, 60)}
                      {(item.content_zh || item.content_en || '').length > 60 ? '...' : ''}
                    </span>
                  </td>
                  <td>{renderStars(item.rating)}</td>
                  <td>{item.source}</td>
                  <td>{item.product_name_zh || item.product_name_en || '-'}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${item.status === 'active' ? styles.statusActive : styles.statusInactive}`}
                      onClick={() => handleToggleTestimonialStatus(item)}
                      title={t('admin.homepage.clickToToggle', 'Click to toggle status')}
                    >
                      {item.status === 'active' ? t('admin.homepage.active', 'Active') : t('admin.homepage.inactive', 'Inactive')}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => handleEditTestimonial(item)}>
                        {t('common.edit', 'Edit')}
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        onClick={() => setTestimonialDeleteConfirm(item)}
                      >
                        {t('common.delete', 'Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Testimonial Form Modal */}
      <Modal
        open={testimonialFormOpen}
        title={editingTestimonial
          ? t('admin.homepage.editTestimonial', '编辑评价')
          : t('admin.homepage.addTestimonial', '添加评价')}
        titleEn={editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}
        size="lg"
        confirmLoading={testimonialSaving}
        onClose={() => { setTestimonialFormOpen(false); setEditingTestimonial(null); }}
        onOk={handleTestimonialSubmit}
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.authorName', 'Author Name')} <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={testimonialForm.author_name}
                onChange={(e) => { setTestimonialForm((p) => ({ ...p, author_name: e.target.value })); setTestimonialErrors((p) => ({ ...p, author_name: '' })); }}
                className={testimonialErrors.author_name ? styles.inputError : ''}
              />
              {renderFieldError(testimonialErrors, 'author_name')}
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.source', 'Source')}</label>
              <select
                value={testimonialForm.source}
                onChange={(e) => setTestimonialForm((p) => ({ ...p, source: e.target.value }))}
              >
                <option value="manual">{t('admin.homepage.sourceManual', 'Manual')}</option>
                <option value="google">{t('admin.homepage.sourceGoogle', 'Google')}</option>
                <option value="tripadvisor">{t('admin.homepage.sourceTripadvisor', 'TripAdvisor')}</option>
                <option value="import">{t('admin.homepage.sourceImport', 'Imported')}</option>
              </select>
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.homepage.field.authorAvatar', 'Author Avatar URL')}</label>
              <input
                type="text"
                value={testimonialForm.author_avatar}
                onChange={(e) => setTestimonialForm((p) => ({ ...p, author_avatar: e.target.value }))}
                placeholder="https://..."
              />
              {renderImagePreview(testimonialForm.author_avatar, 'Avatar preview')}
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.contentZh', 'Content (ZH)')} <span className={styles.required}>*</span></label>
              <textarea
                value={testimonialForm.content_zh}
                onChange={(e) => { setTestimonialForm((p) => ({ ...p, content_zh: e.target.value })); setTestimonialErrors((p) => ({ ...p, content_zh: '' })); }}
                className={testimonialErrors.content_zh ? styles.inputError : ''}
              />
              {renderFieldError(testimonialErrors, 'content_zh')}
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.contentEn', 'Content (EN)')}</label>
              <textarea
                value={testimonialForm.content_en}
                onChange={(e) => setTestimonialForm((p) => ({ ...p, content_en: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.rating', 'Rating')}</label>
              {renderStarRating(testimonialForm.rating, (v) =>
                setTestimonialForm((p) => ({ ...p, rating: v }))
              )}
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.sortOrder', 'Sort Order')}</label>
              <input
                type="number"
                value={testimonialForm.sort_order}
                onChange={(e) => setTestimonialForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                min={0}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.productZh', 'Product (ZH)')}</label>
              <input
                type="text"
                value={testimonialForm.product_name_zh}
                onChange={(e) => setTestimonialForm((p) => ({ ...p, product_name_zh: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.productEn', 'Product (EN)')}</label>
              <input
                type="text"
                value={testimonialForm.product_name_en}
                onChange={(e) => setTestimonialForm((p) => ({ ...p, product_name_en: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.status', 'Status')}</label>
              <select
                value={testimonialForm.status}
                onChange={(e) => setTestimonialForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="active">{t('admin.homepage.active', 'Active')}</option>
                <option value="inactive">{t('admin.homepage.inactive', 'Inactive')}</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Testimonial Delete Confirm */}
      <ConfirmModal
        open={!!testimonialDeleteConfirm}
        type="danger"
        title={t('admin.homepage.deleteTestimonialTitle', '删除评价')}
        titleEn="Delete Testimonial"
        message={t(
          'admin.homepage.deleteTestimonialConfirm',
          `确定要删除 "${testimonialDeleteConfirm?.author_name}" 的评价吗？此操作不可撤销。`
        )}
        messageEn={`Are you sure you want to delete testimonial from "${testimonialDeleteConfirm?.author_name}"? This action cannot be undone.`}
        onConfirm={handleDeleteTestimonial}
        onCancel={() => setTestimonialDeleteConfirm(null)}
      />
    </>
  );

  // ════════════════════════════════════════
  // Tab: Partners
  // ════════════════════════════════════════
  const renderPartnersTab = () => (
    <>
      <div className={styles.toolbar}>
        {renderStatusFilter()}
        <button className={styles.iconBtn} onClick={loadPartners} title={t('common.refresh', 'Refresh')}>
          <RefreshCw size={18} />
        </button>
        <button className={styles.addBtn} onClick={handleAddPartner}>
          <Plus size={18} />
          {t('admin.homepage.addPartner', 'Add Partner')}
        </button>
      </div>
      {renderBatchBar()}
      <div className={styles.tableWrapper}>
        {partnersLoading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : filteredPartners.length === 0 ? (
          <div className={styles.emptyState}>
            {partners.length === 0
              ? t('admin.homepage.noPartners', 'No partners yet')
              : t('admin.homepage.noFilterResults', 'No items match the filter')}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>{renderSelectAllCheckbox(filteredPartners.map((p) => p.id))}</th>
                <th>{t('admin.homepage.logo', 'Logo')}</th>
                <th>{t('admin.homepage.partnerName', 'Name')}</th>
                <th>{t('admin.homepage.website', 'Website')}</th>
                <th>{t('admin.homepage.sortOrder', 'Sort')}</th>
                <th>{t('admin.homepage.status', 'Status')}</th>
                <th>{t('admin.homepage.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.map((item) => (
                <tr key={item.id} className={selectedIds.has(item.id) ? styles.rowSelected : ''}>
                  <td>{renderSelectCheckbox(item.id)}</td>
                  <td>
                    {item.logo ? (
                      <img src={item.logo} alt={item.name} className={styles.logoPreview} />
                    ) : (
                      <div className={styles.logoPlaceholder}>N/A</div>
                    )}
                  </td>
                  <td>{item.name}</td>
                  <td>
                    {item.website ? (
                      <a
                        href={item.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2563eb', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        {item.website.length > 30 ? item.website.slice(0, 30) + '...' : item.website}
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    )}
                  </td>
                  <td>{item.sort_order}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${item.status === 'active' ? styles.statusActive : styles.statusInactive}`}
                      onClick={() => handleTogglePartnerStatus(item)}
                      title={t('admin.homepage.clickToToggle', 'Click to toggle status')}
                    >
                      {item.status === 'active' ? t('admin.homepage.active', 'Active') : t('admin.homepage.inactive', 'Inactive')}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => handleEditPartner(item)}>
                        {t('common.edit', 'Edit')}
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        onClick={() => setPartnerDeleteConfirm(item)}
                      >
                        {t('common.delete', 'Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Partner Form Modal */}
      <Modal
        open={partnerFormOpen}
        title={editingPartner
          ? t('admin.homepage.editPartner', '编辑合作伙伴')
          : t('admin.homepage.addPartner', '添加合作伙伴')}
        titleEn={editingPartner ? 'Edit Partner' : 'Add Partner'}
        size="lg"
        confirmLoading={partnerSaving}
        onClose={() => { setPartnerFormOpen(false); setEditingPartner(null); }}
        onOk={handlePartnerSubmit}
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.partnerName', 'Partner Name')} <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={partnerForm.name}
                onChange={(e) => { setPartnerForm((p) => ({ ...p, name: e.target.value })); setPartnerErrors((p) => ({ ...p, name: '' })); }}
                className={partnerErrors.name ? styles.inputError : ''}
              />
              {renderFieldError(partnerErrors, 'name')}
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.website', 'Website URL')}</label>
              <input
                type="text"
                value={partnerForm.website}
                onChange={(e) => setPartnerForm((p) => ({ ...p, website: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label>{t('admin.homepage.field.logoUrl', 'Logo URL')}</label>
              <input
                type="text"
                value={partnerForm.logo}
                onChange={(e) => setPartnerForm((p) => ({ ...p, logo: e.target.value }))}
                placeholder="https://..."
              />
              {renderImagePreview(partnerForm.logo, 'Logo preview')}
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.sortOrder', 'Sort Order')}</label>
              <input
                type="number"
                value={partnerForm.sort_order}
                onChange={(e) => setPartnerForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                min={0}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.status', 'Status')}</label>
              <select
                value={partnerForm.status}
                onChange={(e) => setPartnerForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="active">{t('admin.homepage.active', 'Active')}</option>
                <option value="inactive">{t('admin.homepage.inactive', 'Inactive')}</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Partner Delete Confirm */}
      <ConfirmModal
        open={!!partnerDeleteConfirm}
        type="danger"
        title={t('admin.homepage.deletePartnerTitle', '删除合作伙伴')}
        titleEn="Delete Partner"
        message={t(
          'admin.homepage.deletePartnerConfirm',
          `确定要删除合作伙伴 "${partnerDeleteConfirm?.name}" 吗？此操作不可撤销。`
        )}
        messageEn={`Are you sure you want to delete partner "${partnerDeleteConfirm?.name}"? This action cannot be undone.`}
        onConfirm={handleDeletePartner}
        onCancel={() => setPartnerDeleteConfirm(null)}
      />
    </>
  );

  // ════════════════════════════════════════
  // Main render
  // ════════════════════════════════════════
  const tabCounts: Record<TabKey, number> = {
    modules: modules.length,
    features: features.length,
    testimonials: testimonials.length,
    partners: partners.length,
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'modules', label: t('admin.homepage.tabModules', 'Modules') },
    { key: 'features', label: t('admin.homepage.tabFeatures', 'Features') },
    { key: 'testimonials', label: t('admin.homepage.tabTestimonials', 'Testimonials') },
    { key: 'partners', label: t('admin.homepage.tabPartners', 'Partners') },
  ];

  const handleTabChange = (key: TabKey) => {
    if (activeTab === 'modules' && JSON.stringify(modules) !== modulesSnapshot.current) {
      if (!window.confirm(t('admin.homepage.unsavedWarning', 'You have unsaved changes in Modules. Discard changes?'))) {
        return;
      }
      // Revert to snapshot
      try {
        setModules(JSON.parse(modulesSnapshot.current));
      } catch { /* ignore */ }
    }
    setActiveTab(key);
    setStatusFilter('all');
    setSelectedIds(new Set());
  };

  // Warn on page leave with unsaved module changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (activeTab === 'modules' && JSON.stringify(modules) !== modulesSnapshot.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activeTab, modules]);

  return (
    <div className={styles.page}>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} position="top-right" onRemove={removeToast} />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>{t('admin.homepage.title', 'Homepage CMS')}</h1>
          <p className={styles.pageDescription}>
            {t('admin.homepage.description', 'Manage homepage modules, features, testimonials and partners')}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.previewBtn}
            onClick={() => navigate('/admin/banners')}
          >
            <Image size={16} />
            {t('admin.homepage.manageBanners', 'Banners')}
          </button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.previewBtn}
          >
            <Eye size={16} />
            {t('admin.homepage.previewHomepage', 'Preview')}
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
            {tabCounts[tab.key] > 0 && (
              <span className={styles.tabBadge}>{tabCounts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'modules' && renderModulesTab()}
      {activeTab === 'features' && renderFeaturesTab()}
      {activeTab === 'testimonials' && renderTestimonialsTab()}
      {activeTab === 'partners' && renderPartnersTab()}

      {/* Batch Delete Confirm */}
      <ConfirmModal
        open={!!batchDeleteConfirmTab}
        type="danger"
        title={t('admin.homepage.batchDeleteTitle', '批量删除')}
        titleEn="Batch Delete"
        message={t(
          'admin.homepage.batchDeleteConfirm',
          `确定要删除选中的 ${selectedIds.size} 项吗？此操作不可撤销。`
        )}
        messageEn={`Are you sure you want to delete ${selectedIds.size} selected items? This action cannot be undone.`}
        onConfirm={handleBatchDelete}
        onCancel={() => setBatchDeleteConfirmTab(null)}
      />
    </div>
  );
};

export default HomepageCMS;
