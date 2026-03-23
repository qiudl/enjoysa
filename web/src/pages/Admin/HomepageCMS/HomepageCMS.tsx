import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Save, Star, ExternalLink } from 'lucide-react';
import { Modal, ConfirmModal } from '../../../components/Common';
import {
  homepageAdminService,
  type HomepageFeature,
  type HomepageTestimonial,
  type HomepagePartner,
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

export const HomepageCMS: React.FC = () => {
  const { t } = useTranslation();

  // ─── Tab state ───
  const [activeTab, setActiveTab] = useState<TabKey>('modules');

  // ─── Modules state ───
  const [modules, setModules] = useState<ModuleEditState[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesSaving, setModulesSaving] = useState(false);

  // ─── Features state ───
  const [features, setFeatures] = useState<HomepageFeature[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featureFormOpen, setFeatureFormOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<HomepageFeature | null>(null);
  const [featureForm, setFeatureForm] = useState<FeatureFormData>(emptyFeatureForm);
  const [featureSaving, setFeatureSaving] = useState(false);
  const [featureDeleteConfirm, setFeatureDeleteConfirm] = useState<HomepageFeature | null>(null);

  // ─── Testimonials state ───
  const [testimonials, setTestimonials] = useState<HomepageTestimonial[]>([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(false);
  const [testimonialFormOpen, setTestimonialFormOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<HomepageTestimonial | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<TestimonialFormData>(emptyTestimonialForm);
  const [testimonialSaving, setTestimonialSaving] = useState(false);
  const [testimonialDeleteConfirm, setTestimonialDeleteConfirm] = useState<HomepageTestimonial | null>(null);
  const [syncing, setSyncing] = useState(false);

  // ─── Partners state ───
  const [partners, setPartners] = useState<HomepagePartner[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnerFormOpen, setPartnerFormOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<HomepagePartner | null>(null);
  const [partnerForm, setPartnerForm] = useState<PartnerFormData>(emptyPartnerForm);
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [partnerDeleteConfirm, setPartnerDeleteConfirm] = useState<HomepagePartner | null>(null);

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
  // Modules
  // ════════════════════════════════════════
  const loadModules = async () => {
    setModulesLoading(true);
    try {
      const result = await homepageAdminService.listModules();
      setModules(
        (result || []).map((m) => ({
          id: m.id,
          module_key: m.module_key,
          title_zh: m.title_zh,
          title_en: m.title_en,
          sort_order: m.sort_order,
          is_visible: m.is_visible,
        }))
      );
    } catch {
      /* ignore */
    }
    setModulesLoading(false);
  };

  const handleModuleSortChange = (id: number, value: number) => {
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, sort_order: value } : m))
    );
  };

  const handleModuleVisibilityToggle = (id: number) => {
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, is_visible: !m.is_visible } : m))
    );
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
      setModules(
        (updated || []).map((m) => ({
          id: m.id,
          module_key: m.module_key,
          title_zh: m.title_zh,
          title_en: m.title_en,
          sort_order: m.sort_order,
          is_visible: m.is_visible,
        }))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
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
      /* ignore */
    }
    setFeaturesLoading(false);
  };

  const handleAddFeature = () => {
    setEditingFeature(null);
    setFeatureForm(emptyFeatureForm);
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
    setFeatureFormOpen(true);
  };

  const handleFeatureSubmit = async () => {
    setFeatureSaving(true);
    try {
      if (editingFeature) {
        const updated = await homepageAdminService.updateFeature(editingFeature.id, featureForm);
        setFeatures((prev) => prev.map((f) => (f.id === editingFeature.id ? updated : f)));
      } else {
        const created = await homepageAdminService.createFeature(featureForm as Omit<HomepageFeature, 'id'>);
        setFeatures((prev) => [...prev, created]);
      }
      setFeatureFormOpen(false);
      setEditingFeature(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    }
    setFeatureSaving(false);
  };

  const handleDeleteFeature = async () => {
    if (!featureDeleteConfirm) return;
    try {
      await homepageAdminService.deleteFeature(featureDeleteConfirm.id);
      setFeatures((prev) => prev.filter((f) => f.id !== featureDeleteConfirm.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
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
      /* ignore */
    }
    setTestimonialsLoading(false);
  };

  const handleSyncTestimonials = async () => {
    setSyncing(true);
    try {
      const result = await homepageAdminService.syncTestimonials();
      alert(t('admin.homepage.syncSuccess', `Synced ${result.synced} reviews`));
      await loadTestimonials();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Sync failed');
    }
    setSyncing(false);
  };

  const handleAddTestimonial = () => {
    setEditingTestimonial(null);
    setTestimonialForm(emptyTestimonialForm);
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
    setTestimonialFormOpen(true);
  };

  const handleTestimonialSubmit = async () => {
    setTestimonialSaving(true);
    try {
      if (editingTestimonial) {
        const updated = await homepageAdminService.updateTestimonial(editingTestimonial.id, testimonialForm);
        setTestimonials((prev) => prev.map((t) => (t.id === editingTestimonial.id ? updated : t)));
      } else {
        const created = await homepageAdminService.createTestimonial(
          testimonialForm as Omit<HomepageTestimonial, 'id'>
        );
        setTestimonials((prev) => [...prev, created]);
      }
      setTestimonialFormOpen(false);
      setEditingTestimonial(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    }
    setTestimonialSaving(false);
  };

  const handleDeleteTestimonial = async () => {
    if (!testimonialDeleteConfirm) return;
    try {
      await homepageAdminService.deleteTestimonial(testimonialDeleteConfirm.id);
      setTestimonials((prev) => prev.filter((t) => t.id !== testimonialDeleteConfirm.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
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
      /* ignore */
    }
    setPartnersLoading(false);
  };

  const handleAddPartner = () => {
    setEditingPartner(null);
    setPartnerForm(emptyPartnerForm);
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
    setPartnerFormOpen(true);
  };

  const handlePartnerSubmit = async () => {
    setPartnerSaving(true);
    try {
      if (editingPartner) {
        const updated = await homepageAdminService.updatePartner(editingPartner.id, partnerForm);
        setPartners((prev) => prev.map((p) => (p.id === editingPartner.id ? updated : p)));
      } else {
        const created = await homepageAdminService.createPartner(partnerForm as Omit<HomepagePartner, 'id'>);
        setPartners((prev) => [...prev, created]);
      }
      setPartnerFormOpen(false);
      setEditingPartner(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    }
    setPartnerSaving(false);
  };

  const handleDeletePartner = async () => {
    if (!partnerDeleteConfirm) return;
    try {
      await homepageAdminService.deletePartner(partnerDeleteConfirm.id);
      setPartners((prev) => prev.filter((p) => p.id !== partnerDeleteConfirm.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
    setPartnerDeleteConfirm(null);
  };

  // ════════════════════════════════════════
  // Render helpers
  // ════════════════════════════════════════
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

  const renderStatusBadge = (status: string) => (
    <span
      className={`${styles.statusBadge} ${
        status === 'active' ? styles.statusActive : styles.statusInactive
      }`}
    >
      {status === 'active'
        ? t('admin.homepage.active', 'Active')
        : t('admin.homepage.inactive', 'Inactive')}
    </span>
  );

  // ════════════════════════════════════════
  // Tab: Modules
  // ════════════════════════════════════════
  const renderModulesTab = () => (
    <>
      <div className={styles.toolbar}>
        <button className={styles.iconBtn} onClick={loadModules} title={t('common.refresh', 'Refresh')}>
          <RefreshCw size={18} />
        </button>
      </div>
      <div className={styles.tableWrapper}>
        {modulesLoading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : modules.length === 0 ? (
          <div className={styles.emptyState}>{t('admin.homepage.noModules', 'No modules found')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.homepage.moduleKey', 'Key')}</th>
                <th>{t('admin.homepage.moduleName', 'Name')}</th>
                <th>{t('admin.homepage.sortOrder', 'Sort')}</th>
                <th>{t('admin.homepage.visible', 'Visible')}</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => (
                <tr key={mod.id}>
                  <td>
                    <span className={styles.moduleKey}>{mod.module_key}</span>
                  </td>
                  <td>
                    <div className={styles.moduleName}>{mod.title_zh}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{mod.title_en}</div>
                  </td>
                  <td>
                    <input
                      type="number"
                      className={styles.sortInput}
                      value={mod.sort_order}
                      onChange={(e) => handleModuleSortChange(mod.id, Number(e.target.value))}
                      min={0}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`${styles.switchTrack} ${mod.is_visible ? styles.switchChecked : ''}`}
                      onClick={() => handleModuleVisibilityToggle(mod.id)}
                      aria-label={mod.is_visible ? 'Disable' : 'Enable'}
                    >
                      <span className={styles.switchThumb} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modules.length > 0 && (
        <div className={styles.saveBar}>
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
    </>
  );

  // ════════════════════════════════════════
  // Tab: Features
  // ════════════════════════════════════════
  const renderFeaturesTab = () => (
    <>
      <div className={styles.toolbar}>
        <button className={styles.iconBtn} onClick={loadFeatures} title={t('common.refresh', 'Refresh')}>
          <RefreshCw size={18} />
        </button>
        <button className={styles.addBtn} onClick={handleAddFeature}>
          <Plus size={18} />
          {t('admin.homepage.addFeature', 'Add Feature')}
        </button>
      </div>
      <div className={styles.tableWrapper}>
        {featuresLoading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : features.length === 0 ? (
          <div className={styles.emptyState}>{t('admin.homepage.noFeatures', 'No features yet')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
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
              {features.map((item) => (
                <tr key={item.id}>
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
                  <td>{renderStatusBadge(item.status)}</td>
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
              <label>{t('admin.homepage.field.icon', 'Icon (emoji or class)')}</label>
              <input
                type="text"
                value={featureForm.icon}
                onChange={(e) => setFeatureForm((p) => ({ ...p, icon: e.target.value }))}
                placeholder="e.g. shield-check"
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.titleZh', 'Title (ZH)')}</label>
              <input
                type="text"
                value={featureForm.title_zh}
                onChange={(e) => setFeatureForm((p) => ({ ...p, title_zh: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.titleEn', 'Title (EN)')}</label>
              <input
                type="text"
                value={featureForm.title_en}
                onChange={(e) => setFeatureForm((p) => ({ ...p, title_en: e.target.value }))}
              />
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
      <div className={styles.tableWrapper}>
        {testimonialsLoading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : testimonials.length === 0 ? (
          <div className={styles.emptyState}>{t('admin.homepage.noTestimonials', 'No testimonials yet')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
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
              {testimonials.map((item) => (
                <tr key={item.id}>
                  <td>{item.author_name}</td>
                  <td>
                    <span className={styles.truncated} title={item.content_zh || item.content_en}>
                      {(item.content_zh || item.content_en || '').slice(0, 60)}
                      {(item.content_zh || item.content_en || '').length > 60 ? '...' : ''}
                    </span>
                  </td>
                  <td>{renderStars(item.rating)}</td>
                  <td>{item.source}</td>
                  <td>{item.product_name_zh || item.product_name_en || '-'}</td>
                  <td>{renderStatusBadge(item.status)}</td>
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
              <label>{t('admin.homepage.field.authorName', 'Author Name')}</label>
              <input
                type="text"
                value={testimonialForm.author_name}
                onChange={(e) => setTestimonialForm((p) => ({ ...p, author_name: e.target.value }))}
              />
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
            </div>
            <div className={styles.formGroup}>
              <label>{t('admin.homepage.field.contentZh', 'Content (ZH)')}</label>
              <textarea
                value={testimonialForm.content_zh}
                onChange={(e) => setTestimonialForm((p) => ({ ...p, content_zh: e.target.value }))}
              />
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
        <button className={styles.iconBtn} onClick={loadPartners} title={t('common.refresh', 'Refresh')}>
          <RefreshCw size={18} />
        </button>
        <button className={styles.addBtn} onClick={handleAddPartner}>
          <Plus size={18} />
          {t('admin.homepage.addPartner', 'Add Partner')}
        </button>
      </div>
      <div className={styles.tableWrapper}>
        {partnersLoading ? (
          <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>
        ) : partners.length === 0 ? (
          <div className={styles.emptyState}>{t('admin.homepage.noPartners', 'No partners yet')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.homepage.logo', 'Logo')}</th>
                <th>{t('admin.homepage.partnerName', 'Name')}</th>
                <th>{t('admin.homepage.website', 'Website')}</th>
                <th>{t('admin.homepage.sortOrder', 'Sort')}</th>
                <th>{t('admin.homepage.status', 'Status')}</th>
                <th>{t('admin.homepage.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((item) => (
                <tr key={item.id}>
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
                  <td>{renderStatusBadge(item.status)}</td>
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
              <label>{t('admin.homepage.field.partnerName', 'Partner Name')}</label>
              <input
                type="text"
                value={partnerForm.name}
                onChange={(e) => setPartnerForm((p) => ({ ...p, name: e.target.value }))}
              />
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
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'modules', label: t('admin.homepage.tabModules', 'Modules') },
    { key: 'features', label: t('admin.homepage.tabFeatures', 'Features') },
    { key: 'testimonials', label: t('admin.homepage.tabTestimonials', 'Testimonials') },
    { key: 'partners', label: t('admin.homepage.tabPartners', 'Partners') },
  ];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>{t('admin.homepage.title', 'Homepage CMS')}</h1>
          <p className={styles.pageDescription}>
            {t('admin.homepage.description', 'Manage homepage modules, features, testimonials and partners')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'modules' && renderModulesTab()}
      {activeTab === 'features' && renderFeaturesTab()}
      {activeTab === 'testimonials' && renderTestimonialsTab()}
      {activeTab === 'partners' && renderPartnersTab()}
    </div>
  );
};

export default HomepageCMS;
