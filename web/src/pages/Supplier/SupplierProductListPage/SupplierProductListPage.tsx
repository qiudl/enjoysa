import React, { useState } from 'react';
import { Header, Footer, Button, Modal } from '../../../components/Common';
import styles from './SupplierProductListPage.module.css';

export interface SupplierProduct {
  id: string;
  title: string;
  titleEn: string;
  image: string;
  price: number;
  stock: number;
  status: 'active' | 'inactive' | 'pending' | 'rejected';
  soldCount: number;
  createdAt: string;
}

export interface SupplierProductListPageProps {
  /** 当前语言 */
  language?: 'zh' | 'en';
  /** 供应商名称 */
  supplierName?: string;
}

const texts = {
  zh: {
    title: '产品管理',
    addProduct: '发布产品',
    search: '搜索产品...',
    filter: '筛选',
    all: '全部',
    active: '已上架',
    inactive: '已下架',
    pending: '待审核',
    rejected: '已驳回',
    productName: '产品名称',
    price: '价格',
    stock: '库存',
    status: '状态',
    soldCount: '已售',
    actions: '操作',
    edit: '编辑',
    view: '查看',
    offline: '下架',
    online: '上架',
    delete: '删除',
    deleteConfirm: '确定要删除该产品吗？',
    cancel: '取消',
    confirm: '确定',
    noProducts: '暂无产品',
    addFirstProduct: '点击上方「发布产品」按钮添加第一个产品',
    statusLabels: {
      active: '已上架',
      inactive: '已下架',
      pending: '待审核',
      rejected: '已驳回',
    },
  },
  en: {
    title: 'Product Management',
    addProduct: 'Add Product',
    search: 'Search products...',
    filter: 'Filter',
    all: 'All',
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    rejected: 'Rejected',
    productName: 'Product Name',
    price: 'Price',
    stock: 'Stock',
    status: 'Status',
    soldCount: 'Sold',
    actions: 'Actions',
    edit: 'Edit',
    view: 'View',
    offline: 'Deactivate',
    online: 'Activate',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this product?',
    cancel: 'Cancel',
    confirm: 'Confirm',
    noProducts: 'No products yet',
    addFirstProduct: 'Click "Add Product" button above to add your first product',
    statusLabels: {
      active: 'Active',
      inactive: 'Inactive',
      pending: 'Pending',
      rejected: 'Rejected',
    },
  },
};

// Mock products
const mockProducts: SupplierProduct[] = [
  {
    id: '1',
    title: '袋鼠岛一日游',
    titleEn: 'Kangaroo Island Day Tour',
    image: 'https://images.unsplash.com/photo-1494947665470-20322015e3a8?w=400',
    price: 389,
    stock: 50,
    status: 'active',
    soldCount: 126,
    createdAt: '2026-01-15',
  },
  {
    id: '2',
    title: '巴罗莎谷酒庄之旅',
    titleEn: 'Barossa Valley Winery Tour',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
    price: 299,
    stock: 30,
    status: 'active',
    soldCount: 89,
    createdAt: '2026-01-10',
  },
  {
    id: '3',
    title: '阿德莱德市区观光',
    titleEn: 'Adelaide City Tour',
    image: 'https://images.unsplash.com/photo-1540202403-b7abd6747a18?w=400',
    price: 159,
    stock: 0,
    status: 'inactive',
    soldCount: 234,
    createdAt: '2026-01-05',
  },
  {
    id: '4',
    title: '维克多港海豚巡游',
    titleEn: 'Victor Harbor Dolphin Cruise',
    image: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=400',
    price: 199,
    stock: 20,
    status: 'pending',
    soldCount: 0,
    createdAt: '2026-01-28',
  },
];

export const SupplierProductListPage: React.FC<SupplierProductListPageProps> = ({
  language = 'zh',
  supplierName = '祥龙旅行社',
}) => {
  const txt = texts[language];
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null);

  const filters = [
    { key: 'all', label: txt.all },
    { key: 'active', label: txt.active },
    { key: 'inactive', label: txt.inactive },
    { key: 'pending', label: txt.pending },
  ];

  const filteredProducts = mockProducts.filter((product) => {
    if (filter !== 'all' && product.status !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        product.title.toLowerCase().includes(query) ||
        product.titleEn.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getStatusStyle = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      active: { bg: '#dcfce7', color: '#166534' },
      inactive: { bg: '#f3f4f6', color: '#6b7280' },
      pending: { bg: '#fef3c7', color: '#92400e' },
      rejected: { bg: '#fee2e2', color: '#991b1b' },
    };
    return styles[status] || styles.inactive;
  };

  const handleDelete = (product: SupplierProduct) => {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    // Handle delete logic
    setShowDeleteModal(false);
    setSelectedProduct(null);
  };

  return (
    <div className={styles.page}>
      <Header isLoggedIn userName={supplierName} />

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{txt.title}</h1>
            <Button variant="primary">
              + {txt.addProduct}
            </Button>
          </div>

          {/* Filters and Search */}
          <div className={styles.toolbar}>
            <div className={styles.filters}>
              {filters.map((f) => (
                <button
                  key={f.key}
                  className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className={styles.search}>
              <input
                type="text"
                placeholder={txt.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* Product List */}
          {filteredProducts.length > 0 ? (
            <div className={styles.productList}>
              <div className={styles.listHeader}>
                <span className={styles.colProduct}>{txt.productName}</span>
                <span className={styles.colPrice}>{txt.price}</span>
                <span className={styles.colStock}>{txt.stock}</span>
                <span className={styles.colSold}>{txt.soldCount}</span>
                <span className={styles.colStatus}>{txt.status}</span>
                <span className={styles.colActions}>{txt.actions}</span>
              </div>
              {filteredProducts.map((product) => {
                const statusStyle = getStatusStyle(product.status);
                return (
                  <div key={product.id} className={styles.listRow}>
                    <div className={styles.colProduct}>
                      <img
                        src={product.image}
                        alt={product.title}
                        className={styles.productImage}
                      />
                      <div className={styles.productInfo}>
                        <span className={styles.productTitle}>
                          {language === 'en' ? product.titleEn : product.title}
                        </span>
                        <span className={styles.productDate}>
                          {product.createdAt}
                        </span>
                      </div>
                    </div>
                    <span className={styles.colPrice}>¥{product.price}</span>
                    <span className={`${styles.colStock} ${product.stock === 0 ? styles.outOfStock : ''}`}>
                      {product.stock}
                    </span>
                    <span className={styles.colSold}>{product.soldCount}</span>
                    <span className={styles.colStatus}>
                      <span
                        className={styles.statusBadge}
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                      >
                        {txt.statusLabels[product.status]}
                      </span>
                    </span>
                    <div className={styles.colActions}>
                      <button className={styles.actionBtn}>{txt.edit}</button>
                      {product.status === 'active' ? (
                        <button className={styles.actionBtn}>{txt.offline}</button>
                      ) : product.status === 'inactive' ? (
                        <button className={styles.actionBtn}>{txt.online}</button>
                      ) : null}
                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => handleDelete(product)}
                      >
                        {txt.delete}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📦</span>
              <p className={styles.emptyText}>{txt.noProducts}</p>
              <p className={styles.emptyHint}>{txt.addFirstProduct}</p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        title={txt.delete}
        size="sm"
        language={language}
        onClose={() => setShowDeleteModal(false)}
        onOk={confirmDelete}
      >
        <p>{txt.deleteConfirm}</p>
        {selectedProduct && (
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {language === 'en' ? selectedProduct.titleEn : selectedProduct.title}
          </p>
        )}
      </Modal>
    </div>
  );
};

export default SupplierProductListPage;
