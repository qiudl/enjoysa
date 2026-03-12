export { StatCard } from './StatCard';
export type { StatCardProps } from './StatCard';

export { Dashboard } from './Dashboard';
export type { DashboardProps, DashboardStats, RecentOrder, TopProduct } from './Dashboard';

export { AdminLayout } from './AdminLayout';

// Supplier Management
export { SupplierStats } from './SupplierStats';
export type { SupplierStatsProps, SupplierStatsData } from './SupplierStats';

export { SupplierTable } from './SupplierTable';
export type { SupplierTableProps, SupplierStatus, SupplierType } from './SupplierTable';
// Note: Supplier type is not re-exported here to avoid conflict with B-side Supplier type
// Import directly from SupplierTable when needed

export { SupplierDetail } from './SupplierDetail';
export type { SupplierDetailProps } from './SupplierDetail';

export { SupplierForm } from './SupplierForm';
export type { SupplierFormProps, SupplierFormData } from './SupplierForm';

// Product Review
export { ProductReviewStats } from './ProductReviewStats';
export type { ProductReviewStatsProps, ProductReviewStatsData } from './ProductReviewStats';

export { ProductReviewTable } from './ProductReviewTable';
export type { ProductReviewTableProps, ProductReview, ProductReviewStatus, ProductCategory } from './ProductReviewTable';

export { ProductReviewDetail } from './ProductReviewDetail';
export type { ProductReviewDetailProps } from './ProductReviewDetail';

// Order Management
// Note: Renamed to avoid conflict with C-side Order components
export { OrderStats as AdminOrderStats } from './OrderStats';
export type { OrderStatsProps as AdminOrderStatsProps, OrderStatsData as AdminOrderStatsData } from './OrderStats';

export { OrderTable as AdminOrderTable } from './OrderTable';
export type { OrderTableProps as AdminOrderTableProps, Order as AdminOrder, OrderStatus as AdminOrderStatus } from './OrderTable';

export { OrderDetail as AdminOrderDetail } from './OrderDetail';
export type { OrderDetailProps as AdminOrderDetailProps } from './OrderDetail';

// User Management
export { UserStats } from './UserStats';
export type { UserStatsProps, UserStatsData } from './UserStats';

export { UserTable } from './UserTable';
export type { UserTableProps, UserData, UserStatus } from './UserTable';

export { UserDetail } from './UserDetail';
export type { UserDetailProps } from './UserDetail';

// Finance Management
export { FinanceStats } from './FinanceStats';
export type { FinanceStatsProps, FinanceStatsData } from './FinanceStats';

export { FinanceTable } from './FinanceTable';
export type { FinanceTableProps, Settlement, SettlementStatus } from './FinanceTable';

export { FinanceDetail } from './FinanceDetail';
export type { FinanceDetailProps } from './FinanceDetail';

export { RevenueChart } from './RevenueChart';
export type { RevenueChartProps, RevenueData } from './RevenueChart';

// Admin User Management
export { AdminTable } from './AdminTable';
export type { AdminTableProps, AdminUser, AdminRole, AdminStatus } from './AdminTable';

export { AdminForm } from './AdminForm';
export type { AdminFormProps, AdminFormData } from './AdminForm';

export { RolePermissions } from './RolePermissions';
export type { RolePermissionsProps, RoleConfig, Permission } from './RolePermissions';
