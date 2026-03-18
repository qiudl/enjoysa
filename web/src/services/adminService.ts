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
  created_at: string;
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
  async listSuppliers(params: { page?: number; page_size?: number; status?: string } = {}) {
    return get<PaginatedResponse<ApiSupplier>>(
      `/admin/suppliers${buildParams(params)}`,
      'admin',
    );
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

export default adminService;
