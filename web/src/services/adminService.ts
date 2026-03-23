/**
 * Admin Service
 * 管理后台 API（需要 admin 认证）
 */

import { get, post, put, del, getAccessToken } from './api';
import type { ApiProduct } from './productService';
import type { ProductPayload } from './supplierProductService';

// 通用分页响应
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 后端 Supplier 响应
export interface ApiSupplier {
  id: number;
  name: string;
  type: string;
  status: string;
  email: string;
  phone: string;
  logo?: string;
  description?: string;
  product_count?: number;
  order_count?: number;
  revenue?: number;
  avg_rating?: number;
  review_count?: number;
  tier?: string;
  rating?: number;
  created_at: string;
}

// 供应商详情
export interface ApiSupplierDetail {
  supplier: ApiSupplier & {
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    bank_name?: string;
    bank_account?: string;
    bank_bsb?: string;
    account_holder?: string;
  };
  users: Array<{ id: number; name: string; email: string; role: string; status: string }>;
  stats: {
    total_revenue: number;
    total_orders: number;
    avg_rating: number;
    cancel_rate: number;
    product_count: number;
    active_products: number;
    pending_settlement: number;
  };
}

// 收入趋势
export interface ApiRevenueTrendItem {
  date: string;
  revenue: number;
  order_count: number;
}

// 审计日志
export interface ApiAuditLogItem {
  id: number;
  source: 'admin' | 'supplier';
  action: string;
  detail: string;
  user_name: string;
  created_at: string;
}

// 结算统计
export interface ApiSettlementStats {
  pending_amount: number;
  completed_amount: number;
  pending_count: number;
  completed_count: number;
}

// 结算记录
export interface ApiSettlement {
  id: number;
  supplier_id: number;
  order_id: number;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  net_amount: number;
  status: string;
  created_at: string;
}

// 评价
export interface ApiReview {
  id: number;
  user_id: number;
  product_id: number;
  supplier_id: number;
  order_id: number;
  rating: number;
  content: string;
  reply?: string;
  status: string;
  created_at: string;
  user?: { id: number; name: string; avatar?: string };
  product?: { id: number; name_zh: string; name_en: string };
}

// 后端 Order 响应
export interface ApiOrder {
  id: number;
  order_no: string;
  status: string;
  user_id: number;
  user_name: string;
  user_phone: string;
  user_email: string;
  supplier_id: number;
  supplier_name: string;
  product_id: number;
  product_name: string;
  booking_date: string;
  quantity: number;
  total_price: number;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  created_at: string;
  payment_time?: string;
  accepted_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancel_reason?: string;
}

// 后端 User 响应
export interface ApiUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: string;
  order_count?: number;
  total_spent?: number;
  created_at: string;
  updated_at: string;
}

// 后端 Product 响应（admin 列表视图）
export interface ApiAdminProduct {
  id: number;
  name_zh: string;
  name_en: string;
  supplier_id: number;
  category_id: number;
  price_from: number;
  status: string;
  created_at: string;
  updated_at: string;
  supplier?: { id: number; name: string; type: string };
  category?: { id: number; slug: string; name_zh: string; name_en: string };
  images?: { id: number; url: string; is_cover: boolean }[];
}

function buildParams(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.append(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const adminService = {
  // === Suppliers ===
  async listSuppliers(params: { page?: number; page_size?: number; status?: string; type?: string; keyword?: string; sort_by?: string; sort_order?: string } = {}) {
    return get<PaginatedResponse<ApiSupplier>>(
      `/admin/suppliers${buildParams(params)}`,
      'admin',
    );
  },

  async getSupplierDetail(id: number) {
    return get<ApiSupplierDetail>(`/admin/suppliers/${id}/detail`, 'admin');
  },

  async updateSupplier(id: number, data: Record<string, unknown>) {
    return put<ApiSupplier>(`/admin/suppliers/${id}`, data, 'admin');
  },

  async approveSupplier(id: number) {
    return post<void>(`/admin/suppliers/${id}/approve`, undefined, 'admin');
  },

  async rejectSupplier(id: number, reason: string) {
    return post<void>(`/admin/suppliers/${id}/reject`, { reason }, 'admin');
  },

  async suspendSupplier(id: number) {
    return post<void>(`/admin/suppliers/${id}/suspend`, undefined, 'admin');
  },

  async getSupplierProducts(id: number, params: { page?: number; page_size?: number; status?: string } = {}) {
    return get<PaginatedResponse<ApiAdminProduct>>(`/admin/suppliers/${id}/products${buildParams(params)}`, 'admin');
  },

  async getSupplierOrders(id: number, params: { page?: number; page_size?: number; status?: string; keyword?: string; start_date?: string; end_date?: string } = {}) {
    return get<PaginatedResponse<ApiOrder>>(`/admin/suppliers/${id}/orders${buildParams(params)}`, 'admin');
  },

  async getSupplierSettlements(id: number, params: { page?: number; page_size?: number } = {}) {
    return get<PaginatedResponse<ApiSettlement>>(`/admin/suppliers/${id}/settlements${buildParams(params)}`, 'admin');
  },

  async getSupplierSettlementStats(id: number) {
    return get<ApiSettlementStats>(`/admin/suppliers/${id}/settlements/stats`, 'admin');
  },

  async getSupplierReviews(id: number, params: { page?: number; page_size?: number } = {}) {
    return get<PaginatedResponse<ApiReview>>(`/admin/suppliers/${id}/reviews${buildParams(params)}`, 'admin');
  },

  async getSupplierAuditLogs(id: number, params: { page?: number; page_size?: number } = {}) {
    return get<{ items: ApiAuditLogItem[]; total: number }>(`/admin/suppliers/${id}/audit-logs${buildParams(params)}`, 'admin');
  },

  async getSupplierRevenueTrend(id: number, days = 30) {
    return get<ApiRevenueTrendItem[]>(`/admin/suppliers/${id}/revenue-trend?days=${days}`, 'admin');
  },

  async forceOfflineProduct(supplierId: number, productId: number, reason: string) {
    return post<void>(`/admin/suppliers/${supplierId}/products/${productId}/force-offline`, { reason }, 'admin');
  },

  async restoreProduct(supplierId: number, productId: number) {
    return post<void>(`/admin/suppliers/${supplierId}/products/${productId}/restore`, undefined, 'admin');
  },

  async refundOrder(orderId: number, data: { amount: number; reason: string; refund_type: 'full' | 'partial' }) {
    return post<void>(`/admin/orders/${orderId}/refund`, data, 'admin');
  },

  // === Orders ===
  async listOrders(params: { page?: number; page_size?: number; status?: string; keyword?: string } = {}) {
    return get<PaginatedResponse<ApiOrder>>(
      `/admin/orders${buildParams(params)}`,
      'admin',
    );
  },

  // === Users ===
  async listUsers(params: { page?: number; page_size?: number; status?: string; keyword?: string } = {}) {
    return get<PaginatedResponse<ApiUser>>(
      `/admin/users${buildParams(params)}`,
      'admin',
    );
  },

  async getUser(id: number) {
    return get<ApiUser>(`/admin/users/${id}`, 'admin');
  },

  async createUser(data: { name: string; email: string; phone?: string; password: string; status?: string }) {
    return post<ApiUser>('/admin/users', data, 'admin');
  },

  async updateUser(id: number, data: { name?: string; email?: string; phone?: string; status?: string }) {
    return put<ApiUser>(`/admin/users/${id}`, data, 'admin');
  },

  async deleteUser(id: number) {
    return del<void>(`/admin/users/${id}`, 'admin');
  },

  async toggleUserStatus(id: number, status: 'active' | 'suspended' | 'banned') {
    return post<void>(`/admin/users/${id}/status`, { status }, 'admin');
  },

  // === Products ===
  async listProducts(params: { page?: number; page_size?: number; status?: string } = {}) {
    return get<PaginatedResponse<ApiAdminProduct>>(
      `/admin/products${buildParams(params)}`,
      'admin',
    );
  },

  async approveProduct(id: number) {
    return post<void>(`/admin/products/${id}/approve`, undefined, 'admin');
  },

  async rejectProduct(id: number, reason?: string) {
    return post<void>(`/admin/products/${id}/reject`, { reason }, 'admin');
  },

  async getProduct(id: number) {
    return get<ApiProduct>(`/admin/products/${id}`, 'admin');
  },

  async createProduct(data: ProductPayload & { supplier_id: number; status?: string; is_featured?: boolean }) {
    return post<ApiProduct>('/admin/products', data, 'admin');
  },

  async updateProduct(id: number, data: ProductPayload & { supplier_id: number; status?: string; is_featured?: boolean }) {
    return put<ApiProduct>(`/admin/products/${id}`, data, 'admin');
  },

  async deleteProduct(id: number) {
    return del<void>(`/admin/products/${id}`, 'admin');
  },

  async uploadFile(file: File): Promise<string> {
    const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';
    const formData = new FormData();
    formData.append('file', file);
    const token = getAccessToken('admin');
    const resp = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const json = await resp.json();
    if (!json.success) {
      throw new Error(json.error || 'Upload failed');
    }
    return json.data.url as string;
  },

  // === Admins ===
  async listAdmins(params: { page?: number; page_size?: number } = {}) {
    return get<PaginatedResponse<ApiAdmin>>(
      `/admin/admins${buildParams(params)}`,
      'admin',
    );
  },

  async createAdmin(data: { email: string; password: string; name: string; role: string }) {
    return post<ApiAdmin>('/admin/admins', data, 'admin');
  },

  async getAdmin(id: number) {
    return get<ApiAdmin>(`/admin/admins/${id}`, 'admin');
  },

  async updateAdmin(id: number, data: { name?: string; email?: string; role?: string; status?: string }) {
    return put<ApiAdmin>(`/admin/admins/${id}`, data, 'admin');
  },

  async deleteAdmin(id: number) {
    return del<void>(`/admin/admins/${id}`, 'admin');
  },

  async toggleAdminStatus(id: number, status: 'active' | 'suspended') {
    return post<void>(`/admin/admins/${id}/status`, { status }, 'admin');
  },

  async resetAdminPassword(id: number, password: string) {
    return post<void>(`/admin/admins/${id}/reset-password`, { password }, 'admin');
  },

  async changePassword(oldPassword: string, newPassword: string) {
    return put<void>('/admin/auth/password', { old_password: oldPassword, new_password: newPassword }, 'admin');
  },

  // === RBAC: Roles ===
  async listRoles() {
    return get<ApiRole[]>('/admin/roles', 'admin');
  },

  async getRole(id: number) {
    return get<ApiRole>(`/admin/roles/${id}`, 'admin');
  },

  async createRole(data: { name: string; code: string; note?: string; sort_order?: number; status?: number }) {
    return post<ApiRole>('/admin/roles', data, 'admin');
  },

  async updateRole(id: number, data: { name?: string; note?: string; sort_order?: number; status?: number }) {
    return put<ApiRole>(`/admin/roles/${id}`, data, 'admin');
  },

  async deleteRole(id: number) {
    return del<void>(`/admin/roles/${id}`, 'admin');
  },

  async getRoleMenus(roleId: number) {
    return get<{ menu_ids: number[] }>(`/admin/roles/${roleId}/menus`, 'admin');
  },

  async updateRoleMenus(roleId: number, menuIds: number[]) {
    return put<void>(`/admin/roles/${roleId}/menus`, { menu_ids: menuIds }, 'admin');
  },

  // === Banners ===
  async listBanners() {
    return get<ApiBanner[]>('/admin/banners', 'admin');
  },

  async createBanner(data: Omit<ApiBanner, 'id' | 'created_at' | 'updated_at'>) {
    return post<ApiBanner>('/admin/banners', data, 'admin');
  },

  async updateBanner(id: number, data: Partial<ApiBanner>) {
    return put<ApiBanner>(`/admin/banners/${id}`, data, 'admin');
  },

  async deleteBanner(id: number) {
    return del<void>(`/admin/banners/${id}`, 'admin');
  },

  // === Regions ===
  async listRegions() {
    return get<ApiRegionAdmin[]>('/admin/regions', 'admin');
  },

  async createRegion(data: Omit<ApiRegionAdmin, 'id' | 'created_at' | 'updated_at' | 'attraction_count'>) {
    return post<ApiRegionAdmin>('/admin/regions', data, 'admin');
  },

  async updateRegion(id: number, data: Partial<ApiRegionAdmin>) {
    return put<ApiRegionAdmin>(`/admin/regions/${id}`, data, 'admin');
  },

  async deleteRegion(id: number) {
    return del<void>(`/admin/regions/${id}`, 'admin');
  },

  // === Categories ===
  async listCategories() {
    return get<ApiCategoryAdmin[]>('/admin/categories', 'admin');
  },

  async createCategory(data: Omit<ApiCategoryAdmin, 'id' | 'created_at' | 'updated_at' | 'product_count'>) {
    return post<ApiCategoryAdmin>('/admin/categories', data, 'admin');
  },

  async updateCategory(id: number, data: Partial<ApiCategoryAdmin>) {
    return put<ApiCategoryAdmin>(`/admin/categories/${id}`, data, 'admin');
  },

  async deleteCategory(id: number) {
    return del<void>(`/admin/categories/${id}`, 'admin');
  },

  // === RBAC: Menus ===
  async listMenus() {
    return get<ApiMenu[]>('/admin/menus', 'admin');
  },

  // === RBAC: Admin Roles ===
  async getAdminRoles(adminId: number) {
    return get<ApiRole[]>(`/admin/admins/${adminId}/roles`, 'admin');
  },

  async updateAdminRoles(adminId: number, roleIds: number[]) {
    return put<void>(`/admin/admins/${adminId}/roles`, { role_ids: roleIds }, 'admin');
  },
};

// 后端 Admin 响应
export interface ApiAdmin {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  created_at: string;
  last_login_at?: string;
}

// RBAC 角色
export interface ApiRole {
  id: number;
  name: string;
  code: string;
  note: string;
  sort_order: number;
  status: number;
  is_system: boolean;
  created_at: string;
}

// RBAC 菜单
export interface ApiMenu {
  id: number;
  parent_id: number;
  name: string;
  title: string;
  title_zh: string;
  icon: string;
  path: string;
  authority: string;
  menu_type: number;
  method: string;
  api_path: string;
  sort_order: number;
  status: number;
  hidden: boolean;
  children?: ApiMenu[];
}

// Banner
export interface ApiBanner {
  id: number;
  title_zh: string;
  title_en: string;
  subtitle_zh: string;
  subtitle_en: string;
  image: string;
  link_url: string;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// Region (admin)
export interface ApiRegionAdmin {
  id: number;
  slug: string;
  name_zh: string;
  name_en: string;
  desc_zh: string;
  desc_en: string;
  tagline_zh: string;
  tagline_en: string;
  image: string;
  sort_order: number;
  attraction_count: number;
  created_at: string;
  updated_at: string;
}

// Category (admin, with product_count)
export interface ApiCategoryAdmin {
  id: number;
  slug: string;
  name_zh: string;
  name_en: string;
  icon: string;
  sort_order: number;
  product_count?: number;
  created_at: string;
  updated_at: string;
}

export default adminService;
