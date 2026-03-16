/**
 * Base API Client
 * 统一的 HTTP 请求封装，支持 JWT token 管理和自动刷新
 */

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

// Token 存储 key
const TOKEN_KEYS = {
  user: { access: 'enjoysa_user_token', refresh: 'enjoysa_user_refresh' },
  supplier: { access: 'enjoysa_supplier_token', refresh: 'enjoysa_supplier_refresh' },
  admin: { access: 'enjoysa_admin_token', refresh: 'enjoysa_admin_refresh' },
} as const;

export type UserType = 'user' | 'supplier' | 'admin';

// API 统一响应格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Token 管理
export function getAccessToken(userType: UserType): string | null {
  return localStorage.getItem(TOKEN_KEYS[userType].access);
}

export function getRefreshToken(userType: UserType): string | null {
  return localStorage.getItem(TOKEN_KEYS[userType].refresh);
}

export function setTokens(userType: UserType, accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEYS[userType].access, accessToken);
  localStorage.setItem(TOKEN_KEYS[userType].refresh, refreshToken);
}

export function clearTokens(userType: UserType): void {
  localStorage.removeItem(TOKEN_KEYS[userType].access);
  localStorage.removeItem(TOKEN_KEYS[userType].refresh);
}

// 请求错误类
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// 通用请求方法
export async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  userType?: UserType,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // 添加 Authorization header
  if (userType) {
    const token = getAccessToken(userType);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // 处理 401 未授权
  if (response.status === 401 && userType) {
    clearTokens(userType);
    throw new ApiError('Unauthorized', 401);
  }

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new ApiError(
      data.error || data.message || 'Request failed',
      response.status,
    );
  }

  return data.data as T;
}

// 便捷方法
export function get<T>(endpoint: string, userType?: UserType): Promise<T> {
  return request<T>(endpoint, { method: 'GET' }, userType);
}

export function post<T>(endpoint: string, body?: unknown, userType?: UserType): Promise<T> {
  return request<T>(
    endpoint,
    {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    },
    userType,
  );
}

export function put<T>(endpoint: string, body?: unknown, userType?: UserType): Promise<T> {
  return request<T>(
    endpoint,
    {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    },
    userType,
  );
}

export function del<T>(endpoint: string, userType?: UserType): Promise<T> {
  return request<T>(endpoint, { method: 'DELETE' }, userType);
}
