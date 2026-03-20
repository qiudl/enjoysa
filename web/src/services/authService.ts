/**
 * Auth Service
 * C端用户、B端供应商、Admin 三端认证 API
 */

import { post, get, put, setTokens, clearTokens, type UserType } from './api';

// ==================== 共享类型 ====================

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// ==================== C端用户 ====================

export interface UserInfo {
  id: number;
  email: string;
  name: string;
  phone: string;
  avatar: string;
  status: string;
  email_verified: boolean;
  phone_verified: boolean;
  language: string;
  currency: string;
  timezone: string;
  created_at: string;
}

interface UserLoginResponse {
  user: UserInfo;
  token: TokenPair;
}

interface UserRegisterResponse {
  user: UserInfo;
  token: TokenPair;
}

interface RefreshResponse {
  token: TokenPair;
}

export const userAuth = {
  async register(email: string, password: string, name: string) {
    const data = await post<UserRegisterResponse>('/auth/register', {
      email,
      password,
      name,
    });
    setTokens('user', data.token.access_token, data.token.refresh_token);
    return data.user;
  },

  async login(email: string, password: string) {
    const data = await post<UserLoginResponse>('/auth/login', {
      email,
      password,
    });
    setTokens('user', data.token.access_token, data.token.refresh_token);
    return data.user;
  },

  async refresh(refreshToken: string) {
    const data = await post<RefreshResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    setTokens('user', data.token.access_token, data.token.refresh_token);
    return data.token;
  },

  async getProfile() {
    return get<UserInfo>('/auth/me', 'user');
  },

  async updateProfile(updates: { name?: string; phone?: string; avatar?: string; language?: string }) {
    return put<UserInfo>('/auth/me', updates, 'user');
  },

  async changePassword(oldPassword: string, newPassword: string) {
    return put<void>('/auth/password', {
      old_password: oldPassword,
      new_password: newPassword,
    }, 'user');
  },

  logout() {
    clearTokens('user');
  },

  async forgotPassword(email: string) {
    return post<{ message: string }>('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string) {
    return post<{ message: string }>('/auth/reset-password', {
      token,
      new_password: newPassword,
    });
  },
};

// ==================== B端供应商 ====================

export interface SupplierInfo {
  id: number;
  name: string;
  type: string;
  status: string;
  email: string;
  phone: string;
  description: string;
  logo: string;
  rating: number;
  review_count: number;
}

export interface SupplierUserInfo {
  id: number;
  supplier_id: number;
  email: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  supplier?: SupplierInfo;
}

interface SupplierLoginResponse {
  supplier_user: SupplierUserInfo;
  token: TokenPair;
}

export const supplierAuth = {
  async login(email: string, password: string) {
    const data = await post<SupplierLoginResponse>('/supplier/auth/login', {
      email,
      password,
    });
    setTokens('supplier', data.token.access_token, data.token.refresh_token);
    return data.supplier_user;
  },

  async refresh(refreshToken: string) {
    const data = await post<RefreshResponse>('/supplier/auth/refresh', {
      refresh_token: refreshToken,
    });
    setTokens('supplier', data.token.access_token, data.token.refresh_token);
    return data.token;
  },

  async getProfile() {
    return get<SupplierUserInfo>('/supplier/auth/me', 'supplier');
  },

  logout() {
    clearTokens('supplier');
  },
};

// ==================== Admin ====================

export interface AdminRoleInfo {
  id: number;
  code: string;
  name: string;
}

export interface AdminMenuInfo {
  id: number;
  parent_id: number;
  name: string;
  title: string;
  title_zh: string;
  icon: string;
  path: string;
  authority: string;
  menu_type: number;
  sort_order: number;
  hidden: boolean;
  children?: AdminMenuInfo[];
}

export interface AdminInfo {
  id: number;
  email: string;
  name: string;
  role?: string;
  status: string;
  avatar?: string;
  roles?: AdminRoleInfo[];
  permissions?: string[];
  menus?: AdminMenuInfo[];
}

interface AdminLoginResponse {
  admin: AdminInfo;
  token: TokenPair;
}

export const adminAuth = {
  async login(email: string, password: string) {
    const data = await post<AdminLoginResponse>('/admin/auth/login', {
      email,
      password,
    });
    setTokens('admin', data.token.access_token, data.token.refresh_token);
    return data.admin;
  },

  async refresh(refreshToken: string) {
    const data = await post<RefreshResponse>('/admin/auth/refresh', {
      refresh_token: refreshToken,
    });
    setTokens('admin', data.token.access_token, data.token.refresh_token);
    return data.token;
  },

  async getProfile() {
    return get<AdminInfo>('/admin/auth/me', 'admin');
  },

  logout() {
    clearTokens('admin');
  },
};

// ==================== 通用工具 ====================

/** 检查指定用户类型是否有有效 token */
export function isTokenPresent(userType: UserType): boolean {
  return !!localStorage.getItem(
    userType === 'user'
      ? 'enjoysa_user_token'
      : userType === 'supplier'
        ? 'enjoysa_supplier_token'
        : 'enjoysa_admin_token',
  );
}
