import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, X, Monitor, Tablet, Smartphone, MapPin, Star, Package } from 'lucide-react';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext';
import { supplierPublicService, transformApiProduct } from '../../../services/productService';
import type { ApiSupplierProfile } from '../../../services/productService';
import type { Product } from '../../../types';
import styles from './ShopPreviewModal.module.css';

type Viewport = 'desktop' | 'tablet' | 'mobile';

export const ShopPreviewModal: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { supplier } = useSupplierAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const isZh = i18n.language.startsWith('zh');

  const supplierId = supplier?.supplier?.id || supplier?.supplier_id;
  const supplierName = supplier?.supplier?.name || supplier?.name || 'My Shop';
  const supplierType = supplier?.supplier?.type || 'travel_agency';

  const [profile, setProfile] = useState<ApiSupplierProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!isOpen || !supplierId) return;
    supplierPublicService.getProfile(supplierId).then(setProfile).catch(() => {});
    supplierPublicService.getProducts(supplierId, { page_size: 8 }).then((data) => {
      setProducts((data.items || []).map(transformApiProduct));
    }).catch(() => {});
  }, [isOpen, supplierId]);

  const rating = profile?.rating ?? 0;
  const productCount = profile?.product_count ?? products.length;
  const reviewCount = profile?.review_count ?? 0;
  const location = profile
    ? [profile.city, profile.state].filter(Boolean).join(', ')
    : '';

  return (
    <>
      <button
        className={styles.previewBtn}
        onClick={() => setIsOpen(true)}
        title={t('supplier.shopPreview.title')}
      >
        <Eye size={18} />
        <span className={styles.previewBtnText}>{t('supplier.shopPreview.button')}</span>
      </button>

      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
              <div className={styles.toolbarLeft}>
                <span className={styles.toolbarTitle}>{t('supplier.shopPreview.title')}</span>
                <div className={styles.viewportSwitch}>
                  <button
                    className={`${styles.viewportBtn} ${viewport === 'desktop' ? styles.active : ''}`}
                    onClick={() => setViewport('desktop')}
                    title="Desktop"
                  >
                    <Monitor size={16} />
                  </button>
                  <button
                    className={`${styles.viewportBtn} ${viewport === 'tablet' ? styles.active : ''}`}
                    onClick={() => setViewport('tablet')}
                    title="Tablet"
                  >
                    <Tablet size={16} />
                  </button>
                  <button
                    className={`${styles.viewportBtn} ${viewport === 'mobile' ? styles.active : ''}`}
                    onClick={() => setViewport('mobile')}
                    title="Mobile"
                  >
                    <Smartphone size={16} />
                  </button>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Preview Content */}
            <div className={styles.previewContainer}>
              <div className={`${styles.previewFrame} ${viewport !== 'desktop' ? styles[viewport] : ''}`}>
                {/* Shop Header */}
                <div className={styles.shopHeader}>
                  <div className={styles.shopBanner}>
                    <div className={styles.shopLogo}>
                      {supplierName.charAt(0)}
                    </div>
                    <div className={styles.shopName}>{supplierName}</div>
                    <span className={styles.shopType}>
                      {t(`supplier.types.${supplierType}`)}
                    </span>
                    <div className={styles.shopStats}>
                      <div className={styles.shopStat}>
                        <div className={styles.shopStatValue}>{rating > 0 ? rating.toFixed(1) : '-'}</div>
                        <div className={styles.shopStatLabel}>{t('supplier.shopPreview.rating')}</div>
                      </div>
                      <div className={styles.shopStat}>
                        <div className={styles.shopStatValue}>{productCount}</div>
                        <div className={styles.shopStatLabel}>{t('supplier.shopPreview.products')}</div>
                      </div>
                      <div className={styles.shopStat}>
                        <div className={styles.shopStatValue}>{reviewCount}</div>
                        <div className={styles.shopStatLabel}>{t('supplier.shopPreview.reviews')}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shop Info */}
                <div className={styles.shopInfo}>
                  {location && (
                    <div className={styles.infoRow}>
                      <MapPin size={16} />
                      <span>{location}</span>
                    </div>
                  )}
                </div>

                {/* Products */}
                <div className={styles.shopProducts}>
                  <h3 className={styles.sectionTitle}>
                    <Package size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    {t('supplier.shopPreview.allProducts')}
                  </h3>
                  {products.length > 0 ? (
                    <div className={styles.productGrid}>
                      {products.map((p) => (
                        <div key={p.id} className={styles.productCard}>
                          <div className={styles.productImage}>
                            {p.images[0] ? (
                              <img src={p.images[0]} alt={isZh ? p.title : p.titleEn} />
                            ) : (
                              <Package size={32} />
                            )}
                          </div>
                          <div className={styles.productBody}>
                            <div className={styles.productTitle}>
                              {isZh ? p.title : p.titleEn}
                            </div>
                            <div className={styles.productPrice}>A${p.price}</div>
                            <div className={styles.productRating}>
                              <Star size={12} fill="#facc15" />
                              <span>{p.rating}</span>
                              <span>({p.reviewCount})</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyProducts}>
                      {t('supplier.shopPreview.noProducts')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShopPreviewModal;
