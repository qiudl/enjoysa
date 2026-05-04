import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
const AdminInsights = lazy(() => import('../../../components/AI/AdminInsights/AdminInsights'));
import { Dashboard } from '../../../components/Admin/Dashboard';
import type { DashboardStats, RecentOrder, TopProduct } from '../../../components/Admin/Dashboard';
import { get } from '../../../services/api';

// 后端 admin dashboard 响应
interface AdminStatsResponse {
  users: number;
  suppliers: number;
  products: number;
  orders: number;
  total_revenue: number;
  pending_suppliers: number;
  pending_products: number;
}

// 后端订单
interface AdminOrder {
  id: number;
  order_no: string;
  product_name: string;
  user_name: string;
  contact_name: string;
  total_price: number;
  status: string;
  created_at: string;
}

// 后端订单列表分页
interface AdminOrderList {
  items: AdminOrder[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const defaultStats: DashboardStats = {
  totalUsers: 0,
  newUsersToday: 0,
  userGrowth: 0,
  totalOrders: 0,
  ordersToday: 0,
  orderGrowth: 0,
  revenue: 0,
  revenueToday: 0,
  revenueGrowth: 0,
  totalProducts: 0,
  activeProducts: 0,
  productGrowth: 0,
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [apiStats, orderList] = await Promise.all([
        get<AdminStatsResponse>('/admin/dashboard/stats', 'admin'),
        get<AdminOrderList>('/admin/orders?page=1&page_size=5', 'admin'),
      ]);

      setStats({
        totalUsers: apiStats.users,
        newUsersToday: 0,
        userGrowth: 0,
        totalOrders: apiStats.orders,
        ordersToday: 0,
        orderGrowth: 0,
        revenue: apiStats.total_revenue,
        revenueToday: 0,
        revenueGrowth: 0,
        totalProducts: apiStats.products,
        activeProducts: apiStats.products - apiStats.pending_products,
        productGrowth: 0,
      });

      setRecentOrders(
        (orderList.items || []).map((o) => ({
          id: String(o.id),
          orderNo: o.order_no,
          productName: o.product_name,
          productNameEn: o.product_name,
          customerName: o.contact_name || o.user_name,
          amount: o.total_price,
          status: o.status as RecentOrder['status'],
          createdAt: o.created_at,
        })),
      );
    } catch {
      // Fallback: keep defaults
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = (order: RecentOrder) => {
    navigate(`/admin/orders?highlight=${order.id}`);
  };

  const handleViewProduct = (product: TopProduct) => {
    navigate(`/admin/products?highlight=${product.id}`);
  };

  const handleViewAllOrders = () => {
    navigate('/admin/orders');
  };

  const handleViewAllProducts = () => {
    navigate('/admin/products');
  };

  return (
    <>
    <Suspense fallback={null}><AdminInsights /></Suspense>
    <Dashboard
      stats={stats}
      recentOrders={recentOrders}
      topProducts={topProducts}
      loading={loading}
      onViewOrder={handleViewOrder}
      onViewProduct={handleViewProduct}
      onViewAllOrders={handleViewAllOrders}
      onViewAllProducts={handleViewAllProducts}
    />
    </>
  );
};

export default DashboardPage;
