import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header, Footer, Button } from '../../../components/Common';
import { post, put } from '../../../services/api';
import styles from './SupplierProductFormPage.module.css';

export interface SupplierProductFormPageProps {
  /** 供应商名称 */
  supplierName?: string;
  /** 产品ID (编辑模式) */
  productId?: string;
  /** 导航回调 */
  onNavigate?: (path: string) => void;
}

export const SupplierProductFormPage: React.FC<SupplierProductFormPageProps> = ({
  supplierName = '供应商',
  productId,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const isEditMode = !!productId;

  const [formData, setFormData] = useState({
    title: '',
    titleEn: '',
    description: '',
    descriptionEn: '',
    price: '',
    stock: '',
    category: '',
    duration: '',
    meetingPoint: '',
    includes: '',
    excludes: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name_zh: formData.title,
        name_en: formData.titleEn,
        description_zh: formData.description,
        description_en: formData.descriptionEn,
        price_from: parseFloat(formData.price) || 0,
        duration: formData.duration,
        address_zh: formData.meetingPoint,
      };
      if (isEditMode && productId) {
        await put(`/supplier/products/${productId}`, payload, 'supplier');
      } else {
        await post('/supplier/products', payload, 'supplier');
      }
      onNavigate?.('/supplier/products');
    } catch {
      // submission failed
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Header isLoggedIn userName={supplierName} />

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Breadcrumb */}
          <nav className={styles.breadcrumb}>
            <button onClick={() => onNavigate?.('/supplier/products')} className={styles.breadcrumbLink}>
              {t('supplier.products.title')}
            </button>
            <span className={styles.breadcrumbSep}>/</span>
            <span>{isEditMode ? t('supplier.products.edit') : t('supplier.products.addProduct')}</span>
          </nav>

          {/* Page Title */}
          <h1 className={styles.pageTitle}>
            {isEditMode ? t('supplier.products.edit') : t('supplier.products.addProduct')}
          </h1>

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Basic Info Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t('supplier.productForm.basicInfo')}</h2>

              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.productForm.titleZh')} *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className={styles.input}
                  placeholder={t('supplier.productForm.titleZhPlaceholder')}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.productForm.titleEn')} *</label>
                <input
                  type="text"
                  name="titleEn"
                  value={formData.titleEn}
                  onChange={handleInputChange}
                  className={styles.input}
                  placeholder={t('supplier.productForm.titleEnPlaceholder')}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.productForm.descriptionZh')}</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className={styles.textarea}
                  placeholder={t('supplier.productForm.descriptionPlaceholder')}
                  rows={4}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.productForm.descriptionEn')}</label>
                <textarea
                  name="descriptionEn"
                  value={formData.descriptionEn}
                  onChange={handleInputChange}
                  className={styles.textarea}
                  placeholder={t('supplier.productForm.descriptionPlaceholder')}
                  rows={4}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.category')}</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={styles.select}
                  >
                    <option value="">{t('supplier.productForm.selectCategory')}</option>
                    <option value="day_tour">{t('supplier.productForm.categories.dayTour')}</option>
                    <option value="multi_day">{t('supplier.productForm.categories.multiDay')}</option>
                    <option value="activity">{t('supplier.productForm.categories.activity')}</option>
                    <option value="ticket">{t('supplier.productForm.categories.ticket')}</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.duration')}</label>
                  <input
                    type="text"
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder={t('supplier.productForm.durationPlaceholder')}
                  />
                </div>
              </div>
            </section>

            {/* Pricing Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t('supplier.productForm.pricing')}</h2>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.price')} *</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.productForm.stock')}</label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            </section>

            {/* Details Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t('supplier.productForm.details')}</h2>

              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.productForm.meetingPoint')}</label>
                <input
                  type="text"
                  name="meetingPoint"
                  value={formData.meetingPoint}
                  onChange={handleInputChange}
                  className={styles.input}
                  placeholder={t('supplier.productForm.meetingPointPlaceholder')}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.productForm.includes')}</label>
                <textarea
                  name="includes"
                  value={formData.includes}
                  onChange={handleInputChange}
                  className={styles.textarea}
                  placeholder={t('supplier.productForm.includesPlaceholder')}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.productForm.excludes')}</label>
                <textarea
                  name="excludes"
                  value={formData.excludes}
                  onChange={handleInputChange}
                  className={styles.textarea}
                  placeholder={t('supplier.productForm.excludesPlaceholder')}
                  rows={3}
                />
              </div>
            </section>

            {/* Actions */}
            <div className={styles.actions}>
              <Button
                variant="secondary"
                type="button"
                onClick={() => onNavigate?.('/supplier/products')}
              >
                {t('common.cancel')}
              </Button>
              <Button variant="primary" type="submit" disabled={submitting} loading={submitting}>
                {isEditMode ? t('common.save') : t('supplier.productForm.publish')}
              </Button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SupplierProductFormPage;
