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
  console.warn(`[API] clearTokens(${userType}) called`);
  localStorage.removeItem(TOKEN_KEYS[userType].access);
  localStorage.removeItem(TOKEN_KEYS[userType].refresh);
}

// Refresh endpoints by user type. Kept here (not in authService) to avoid
// a circular import — authService already imports from this module.
const REFRESH_ENDPOINTS: Record<UserType, string> = {
  user: '/auth/refresh',
  supplier: '/supplier/auth/refresh',
  admin: '/admin/auth/refresh',
};

// Single-flight refresh: if N requests hit 401 concurrently, only one
// /refresh call is sent; the rest await the same promise and reuse the
// resulting access token. The map is exported for test-only reset.
export const _refreshInFlight = new Map<UserType, Promise<string>>();

async function performRefresh(userType: UserType): Promise<string> {
  const refreshToken = getRefreshToken(userType);
  if (!refreshToken) {
    throw new ApiError('no refresh token', 401);
  }

  // Direct fetch (not request()) so a 401 from the refresh endpoint itself
  // can never trigger a refresh-on-refresh recursion.
  const resp = await fetch(`${API_BASE}${REFRESH_ENDPOINTS[userType]}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!resp.ok) {
    throw new ApiError(`refresh status ${resp.status}`, resp.status);
  }

  const json: ApiResponse<{ token?: { access_token?: string; refresh_token?: string } }> =
    await resp.json();
  const tok = json.data?.token;
  if (!json.success || !tok?.access_token || !tok.refresh_token) {
    throw new ApiError('refresh response invalid', 502);
  }

  setTokens(userType, tok.access_token, tok.refresh_token);
  return tok.access_token;
}

function tryRefresh(userType: UserType): Promise<string> {
  const existing = _refreshInFlight.get(userType);
  if (existing) return existing;

  const promise = performRefresh(userType).finally(() => {
    _refreshInFlight.delete(userType);
  });
  _refreshInFlight.set(userType, promise);
  return promise;
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
  return requestWithRetry<T>(endpoint, options, userType, false);
}

async function requestWithRetry<T>(
  endpoint: string,
  options: RequestInit,
  userType: UserType | undefined,
  isRetry: boolean,
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

  // 处理 401 未授权 — 尝试用 refresh_token 续期一次后重试原请求
  if (response.status === 401 && userType) {
    if (!isRetry && getRefreshToken(userType)) {
      try {
        await tryRefresh(userType);
        return await requestWithRetry<T>(endpoint, options, userType, true);
      } catch (refreshErr) {
        console.warn(`[API] refresh failed for ${userType}:`, refreshErr);
        // fall through to normal 401 handling
      }
    }
    const body = await response.clone().text();
    console.warn(`[API] 401 on ${endpoint} | body=${body}`);
    clearTokens(userType);
    throw new ApiError('Unauthorized', 401);
  }

  // 处理 403 无权限
  if (response.status === 403) {
    let msg = 'Insufficient permissions';
    try {
      const data403: ApiResponse = await response.json();
      msg = data403.error || data403.message || msg;
    } catch {
      // Non-JSON 403 (e.g. from reverse proxy)
    }
    throw new ApiError(msg, 403);
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

export function patch<T>(endpoint: string, body?: unknown, userType?: UserType): Promise<T> {
  return request<T>(
    endpoint,
    {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    },
    userType,
  );
}
