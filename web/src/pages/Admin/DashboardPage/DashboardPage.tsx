import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dashboard } from '../../../components/Admin/Dashboard';
import type { DashboardStats, RecentOrder, TopProduct } from '../../../components/Admin/Dashboard';

// Mock data for demonstration
const mockStats: DashboardStats = {
  totalUsers: 3256,
  newUsersToday: 12,
  userGrowth: 8.5,
  totalOrders: 1256,
  ordersToday: 23,
  orderGrowth: 12.3,
  revenue: 256800,
  revenueToday: 8560,
  revenueGrowth: 15.2,
  totalProducts: 186,
  activeProducts: 142,
  productGrowth: 5.8,
};

const mockRecentOrders: RecentOrder[] = [
  {
    id: '1',
    orderNo: 'ORD202602020001',
    productName: '袋鼠岛一日游',
    productNameEn: 'Kangaroo Island Day Tour',
    customerName: '张三',
    amount: 598,
    status: 'pending',
    createdAt: '2026-02-02T10:30:00Z',
  },
  {
    id: '2',
    orderNo: 'ORD202602020002',
    productName: '巴罗莎谷品酒之旅',
    productNameEn: 'Barossa Valley Wine Tour',
    customerName: 'John Smith',
    amount: 756,
    status: 'confirmed',
    createdAt: '2026-02-02T09:15:00Z',
  },
  {
    id: '3',
    orderNo: 'ORD202602010003',
    productName: '阿德莱德城市观光',
    productNameEn: 'Adelaide City Tour',
    customerName: '李四',
    amount: 267,
    status: 'completed',
    createdAt: '2026-02-01T14:20:00Z',
  },
  {
    id: '4',
    orderNo: 'ORD202602010004',
    productName: '克莱兰德野生动物园门票',
    productNameEn: 'Cleland Wildlife Park Ticket',
    customerName: 'Sarah Johnson',
    amount: 175,
    status: 'completed',
    createdAt: '2026-02-01T11:45:00Z',
  },
  {
    id: '5',
    orderNo: 'ORD202601310005',
    productName: '阿德莱德山一日游',
    productNameEn: 'Adelaide Hills Day Tour',
    customerName: '王五',
    amount: 389,
    status: 'cancelled',
    createdAt: '2026-01-31T16:30:00Z',
  },
];

const mockTopProducts: TopProduct[] = [
  {
    id: '1',
    name: '袋鼠岛两日游',
    nameEn: 'Kangaroo Island 2-Day Tour',
    sales: 156,
    revenue: 93400,
    rating: 4.9,
  },
  {
    id: '2',
    name: '巴罗莎谷品酒之旅',
    nameEn: 'Barossa Valley Wine Tour',
    sales: 128,
    revenue: 48640,
    rating: 4.8,
  },
  {
    id: '3',
    name: '袋鼠岛一日游',
    nameEn: 'Kangaroo Island Day Tour',
    sales: 98,
    revenue: 29400,
    rating: 4.7,
  },
  {
    id: '4',
    name: '阿德莱德城市观光',
    nameEn: 'Adelaide City Tour',
    sales: 86,
    revenue: 12900,
    rating: 4.6,
  },
  {
    id: '5',
    name: '克莱兰德野生动物园门票',
    nameEn: 'Cleland Wildlife Park Ticket',
    sales: 72,
    revenue: 5040,
    rating: 4.5,
  },
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(mockStats);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setStats(mockStats);
    setRecentOrders(mockRecentOrders);
    setTopProducts(mockTopProducts);
    setLoading(false);
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
  );
};

export default DashboardPage;
