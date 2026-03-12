import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download } from 'lucide-react';
import clsx from 'clsx';
import { ProductReviewStats } from '../../../components/Admin/ProductReviewStats';
import type { ProductReviewStatsData } from '../../../components/Admin/ProductReviewStats';
import { ProductReviewTable } from '../../../components/Admin/ProductReviewTable';
import type { ProductReview, ProductReviewStatus } from '../../../components/Admin/ProductReviewTable';
import { ProductReviewDetail } from '../../../components/Admin/ProductReviewDetail';
import styles from './ProductReviewList.module.css';

// Mock data for demonstration
const mockProducts: ProductReview[] = [
  {
    id: '1',
    name: '袋鼠岛一日游',
    nameEn: 'Kangaroo Island Day Tour',
    category: 'day_tour',
    supplierId: '1',
    supplierName: '祥龙旅行社',
    price: 299,
    originalPrice: 359,
    status: 'pending',
    submittedAt: '2026-01-30T10:30:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200',
    description: '探索袋鼠岛的野生动物和自然美景，包含海豹湾、神奇岩石等景点。',
  },
  {
    id: '2',
    name: '巴罗莎谷品酒之旅',
    nameEn: 'Barossa Valley Wine Tour',
    category: 'day_tour',
    supplierId: '1',
    supplierName: '祥龙旅行社',
    price: 189,
    status: 'approved',
    submittedAt: '2026-01-28T14:20:00Z',
    reviewedAt: '2026-01-29T09:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=200',
    description: '品尝世界级葡萄酒，游览历史悠久的酒庄。',
  },
  {
    id: '3',
    name: '阿德莱德城市观光',
    nameEn: 'Adelaide City Highlights',
    category: 'activity',
    supplierId: '2',
    supplierName: '阳光旅游',
    price: 89,
    status: 'pending',
    submittedAt: '2026-01-31T09:00:00Z',
    description: '探索阿德莱德市中心的历史建筑和文化景点。',
  },
  {
    id: '4',
    name: '克莱兰德野生动物园门票',
    nameEn: 'Cleland Wildlife Park Ticket',
    category: 'ticket',
    supplierId: '3',
    supplierName: '袋鼠岛景区',
    price: 35,
    originalPrice: 45,
    status: 'rejected',
    submittedAt: '2026-01-25T11:30:00Z',
    reviewedAt: '2026-01-26T15:00:00Z',
    reviewNote: '价格信息不完整，请补充儿童票和家庭票价格。',
  },
  {
    id: '5',
    name: '蓝湖一日游',
    nameEn: 'Blue Lake Day Trip',
    category: 'day_tour',
    supplierId: '1',
    supplierName: '祥龙旅行社',
    price: 259,
    status: 'pending',
    submittedAt: '2026-02-01T08:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200',
    description: '前往甘比尔山探索神秘的蓝湖，观赏季节性变色奇观。',
  },
];

const mockStats: ProductReviewStatsData = {
  total: 86,
  pending: 12,
  approved: 68,
  rejected: 6,
  todayNew: 3,
};

type TabKey = 'all' | 'pending' | 'approved' | 'rejected';

export const ProductReviewList: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductReview[]>([]);
  const [stats, setStats] = useState<ProductReviewStatsData>(mockStats);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductReview | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setProducts(mockProducts);
    setStats(mockStats);
    setLoading(false);
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all', label: t('admin.products.tabs.all'), count: stats.total },
    { key: 'pending', label: t('admin.products.tabs.pending'), count: stats.pending },
    { key: 'approved', label: t('admin.products.tabs.approved'), count: stats.approved },
    { key: 'rejected', label: t('admin.products.tabs.rejected'), count: stats.rejected },
  ];

  const filteredProducts = products.filter((product) => {
    // Filter by tab
    if (activeTab !== 'all' && product.status !== activeTab) {
      return false;
    }
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(query) ||
        product.nameEn?.toLowerCase().includes(query) ||
        product.supplierName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleView = (product: ProductReview) => {
    setSelectedProduct(product);
    setDetailOpen(true);
  };

  const handleApprove = async (product: ProductReview) => {
    // API call to approve
    console.log('Approve product:', product.id);
    // Update local state
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, status: 'approved' as ProductReviewStatus } : p))
    );
    setDetailOpen(false);
  };

  const handleReject = async (product: ProductReview, reason: string) => {
    // API call to reject
    console.log('Reject product:', product.id, 'Reason:', reason);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id
          ? { ...p, status: 'rejected' as ProductReviewStatus, reviewNote: reason }
          : p
      )
    );
    setDetailOpen(false);
  };

  const handleStatClick = (status: string) => {
    if (status === 'total') {
      setActiveTab('all');
    } else {
      setActiveTab(status as TabKey);
    }
  };

  return (
    <div className={styles.page}>
      {/* Stats */}
      <ProductReviewStats data={stats} loading={loading} onStatClick={handleStatClick} />

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* Tabs */}
          <div className={styles.tabs}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={clsx(styles.tab, activeTab === tab.key && styles.active)}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={styles.tabCount}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          {/* Search */}
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t('admin.products.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Actions */}
          <button className={styles.iconBtn} onClick={loadData} title={t('common.refresh')}>
            <RefreshCw size={18} />
          </button>
          <button className={styles.iconBtn} title={t('admin.products.export')}>
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Table */}
      <ProductReviewTable
        products={filteredProducts}
        loading={loading}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        onView={handleView}
        onApprove={handleApprove}
        onReject={(p) => handleReject(p, '')}
      />

      {/* Pagination */}
      {!loading && filteredProducts.length > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            {t('admin.products.showing', {
              from: 1,
              to: filteredProducts.length,
              total: filteredProducts.length,
            })}
          </span>
        </div>
      )}

      {/* Detail Drawer */}
      <ProductReviewDetail
        product={selectedProduct}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
};

export default ProductReviewList;
