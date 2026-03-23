import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, X, Monitor, Tablet, Smartphone, MapPin, Clock, Star, Package } from 'lucide-react';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext';
import styles from './ShopPreviewModal.module.css';

type Viewport = 'desktop' | 'tablet' | 'mobile';

// Mock products for preview
const mockProducts = [
  { id: '1', title: '袋鼠岛一日游', titleEn: 'Kangaroo Island Day Tour', price: 289, rating: 4.8, reviews: 156, image: '' },
  { id: '2', title: '巴罗莎谷酒庄之旅', titleEn: 'Barossa Valley Winery Tour', price: 199, rating: 4.6, reviews: 98, image: '' },
  { id: '3', title: '阿德莱德城市观光', titleEn: 'Adelaide City Sightseeing', price: 129, rating: 4.5, reviews: 72, image: '' },
  { id: '4', title: '弗林德斯山脉探险', titleEn: 'Flinders Ranges Adventure', price: 459, rating: 4.9, reviews: 43, image: '' },
];

export const ShopPreviewModal: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { supplier } = useSupplierAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const isZh = i18n.language.startsWith('zh');

  const supplierName = supplier?.supplier?.name || supplier?.name || 'My Shop';
  const supplierType = supplier?.supplier?.type || 'travel_agency';

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
                        <div className={styles.shopStatValue}>4.7</div>
                        <div className={styles.shopStatLabel}>{t('supplier.shopPreview.rating')}</div>
                      </div>
                      <div className={styles.shopStat}>
                        <div className={styles.shopStatValue}>{mockProducts.length}</div>
                        <div className={styles.shopStatLabel}>{t('supplier.shopPreview.products')}</div>
                      </div>
                      <div className={styles.shopStat}>
                        <div className={styles.shopStatValue}>369</div>
                        <div className={styles.shopStatLabel}>{t('supplier.shopPreview.reviews')}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shop Info */}
                <div className={styles.shopInfo}>
                  <div className={styles.infoRow}>
                    <MapPin size={16} />
                    <span>{isZh ? '南澳大利亚，阿德莱德' : 'Adelaide, South Australia'}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <Clock size={16} />
                    <span>{isZh ? '营业时间: 09:00 - 18:00' : 'Hours: 09:00 - 18:00'}</span>
                  </div>
                </div>

                {/* Products */}
                <div className={styles.shopProducts}>
                  <h3 className={styles.sectionTitle}>
                    <Package size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    {t('supplier.shopPreview.allProducts')}
                  </h3>
                  {mockProducts.length > 0 ? (
                    <div className={styles.productGrid}>
                      {mockProducts.map((p) => (
                        <div key={p.id} className={styles.productCard}>
                          <div className={styles.productImage}>
                            <Package size={32} />
                          </div>
                          <div className={styles.productBody}>
                            <div className={styles.productTitle}>
                              {isZh ? p.title : p.titleEn}
                            </div>
                            <div className={styles.productPrice}>A${p.price}</div>
                            <div className={styles.productRating}>
                              <Star size={12} fill="#facc15" />
                              <span>{p.rating}</span>
                              <span>({p.reviews})</span>
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
