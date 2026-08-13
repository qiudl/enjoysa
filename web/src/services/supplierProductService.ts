/**
 * Supplier Product Service
 * 供应商产品管理 API（需要 supplier 认证）
 */

import { get, post, put, patch, del, getAccessToken } from './api';
import type { ApiProduct, ApiProductSchedule } from './productService';
import type { BatchStockRequest, BatchStockResponse, PackageFlat } from './adminService';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

// 分页响应
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 创建/更新产品请求
export interface ProductPayload {
  name_zh: string;
  name_en: string;
  region_id?: number;
  category_id?: number;
  price_from?: number;
  summary_zh?: string;
  summary_en?: string;
  description_zh?: string;
  description_en?: string;
  booking_notice_zh?: string;
  booking_notice_en?: string;
  address_zh?: string;
  address_en?: string;
  duration?: string;
  group_size?: string;
  tags?: string;
  // REQ-20260511-0006: supplier 可上传产品 banner 图作为资产准备。
  // 是否真出现在首页 carousel 由 admin 控（is_featured + carousel_rank）。
  banner_image?: string;
  images?: ImagePayload[];
  packages?: PackagePayload[];
  highlights?: HighlightPayload[];
  faqs?: FAQPayload[];
}

export interface ImagePayload {
  url: string;
  sort_order: number;
  is_cover: boolean;
}

export interface PackagePayload {
  name_zh: string;
  name_en: string;
  desc_zh?: string;
  desc_en?: string;
  price: number;
  sort_order?: number;
  // REQ-20260509-0035: stock_total = -1 表示无限量；不传时后端按 -1 处理。
  // stock_sold 由后端维护，编辑表单会把它当作只读展示。
  stock_total?: number;
  stock_sold?: number;
  // REQ-20260510-0004: per-package alert threshold. 0 = alerts off; >0 fires
  // an inventory_low notification when remaining drops to/below this.
  low_stock_threshold?: number;
}

export interface HighlightPayload {
  title_zh: string;
  title_en: string;
  desc_zh?: string;
  desc_en?: string;
  sort_order?: number;
}

export interface FAQPayload {
  question_zh: string;
  question_en: string;
  answer_zh: string;
  answer_en: string;
  sort_order?: number;
}

export type TranslationTaskStatus = 'pending' | 'running' | 'success' | 'failed';

export interface TranslationStatus {
  task_id: number;
  status: TranslationTaskStatus;
  retries: number;
  last_error?: string;
  updated_at: string;
  preview?: {
    name_zh?: string;
    summary_zh?: string;
    description_zh?: string;
    address_zh?: string;
  };
}

export const supplierProductService = {
  /** 供应商产品列表 */
  async list(params: { page?: number; page_size?: number; status?: string } = {}) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') sp.append(k, String(v));
    });
    const qs = sp.toString();
    return get<PaginatedResponse<ApiProduct>>(
      `/supplier/products${qs ? `?${qs}` : ''}`,
      'supplier',
    );
  },

  /** 获取单个产品详情 */
  async getById(id: number) {
    return get<ApiProduct>(`/supplier/products/${id}`, 'supplier');
  },

  /** 创建产品 */
  async create(data: ProductPayload) {
    return post<ApiProduct>('/supplier/products', data, 'supplier');
  },

  /** 更新产品 */
  async update(id: number, data: ProductPayload) {
    return put<ApiProduct>(`/supplier/products/${id}`, data, 'supplier');
  },

  /** 删除产品 */
  async remove(id: number) {
    return del<void>(`/supplier/products/${id}`, 'supplier');
  },

  /**
   * REQ-20260509-0035 Phase 3a: 列表页快速调整库存。绕开 update() 重型流程
   * （不触发翻译重置 / 不重新走审核）。stock_total = -1 表示无限量。
   * 后端镜像 admin 的同名端点，加 supplier ownership 校验。
   * REQ-20260510-0005: lowStockThreshold 可选 — Excel 导入时一并下发。
   */
  async updatePackageStock(
    productId: number,
    packageId: number,
    stockTotal: number,
    lowStockThreshold?: number,
  ) {
    const body: { stock_total: number; low_stock_threshold?: number } = { stock_total: stockTotal };
    if (lowStockThreshold !== undefined) body.low_stock_threshold = lowStockThreshold;
    return patch<{ id: number; stock_total: number; stock_sold: number; low_stock_threshold?: number }>(
      `/supplier/products/${productId}/packages/${packageId}/stock`,
      body,
      'supplier',
    );
  },

  /**
   * REQ-20260509-0035 Phase 3b: 批量库存调整。镜像 admin batch-stock，但
   * 后端用 ctx supplier_id 强制 ownership — supplier 永远只能改自家商品。
   * 单事务，op=add/sub 跳过 unlimited(-1)；op=set/zero 覆写含 -1。
   */
  async batchAdjustStock(req: BatchStockRequest) {
    return post<BatchStockResponse>('/supplier/products/batch-stock', req, 'supplier');
  },

  /**
   * REQ-20260510-0005: Excel 导入用 — supplier 端 flat 套餐行（仅自家产品）。
   * 后端按 ctx supplier_id 强制 scope，前端无需传 supplier_id。
   */
  async listPackagesFlat(productIds?: number[]) {
    const qs = productIds && productIds.length > 0
      ? `?product_ids=${productIds.join(',')}`
      : '';
    return get<PackageFlat[]>(`/supplier/products/packages-flat${qs}`, 'supplier');
  },

  /** 提交审核 */
  async submitForReview(id: number) {
    return post<{ message?: string; translation_task_id?: number }>(
      `/supplier/products/${id}/submit`,
      undefined,
      'supplier',
    );
  },

  /**
   * REQ-20260508-0002: poll the AI translation task that was enqueued when
   * the supplier hit Submit for review. Returns the task status plus a
   * `preview` map of `*_zh` strings once it succeeds.
   */
  async getTranslationStatus(id: number) {
    return get<TranslationStatus>(`/supplier/products/${id}/translation-status`, 'supplier');
  },

  /** Manually retry a failed translation. */
  async retryTranslation(id: number) {
    return post<{ task_id: number; status: string }>(
      `/supplier/products/${id}/translation-retry`,
      undefined,
      'supplier',
    );
  },

  /** 上架 */
  async online(id: number) {
    return post<void>(`/supplier/products/${id}/online`, undefined, 'supplier');
  },

  /** 下架 */
  async offline(id: number) {
    return post<void>(`/supplier/products/${id}/offline`, undefined, 'supplier');
  },

  /** 上传文件 */
  async upload(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAccessToken('supplier');
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

  // === Schedules ===

  /** 获取产品排期（使用公开 API，返回未来 60 天） */
  async getSchedules(productId: number) {
    return get<ApiProductSchedule[]>(`/products/${productId}/schedules`);
  },

  /** 创建单个排期 */
  async createSchedule(productId: number, data: {
    package_id?: number;
    date: string;
    time_slot?: string;
    total_slots: number;
    price?: number | null;
  }) {
    return post<ApiProductSchedule>(`/supplier/products/${productId}/schedules`, data, 'supplier');
  },

  /** 批量创建排期 */
  async batchCreateSchedules(productId: number, schedules: {
    package_id?: number;
    date: string;
    time_slot?: string;
    total_slots: number;
    price?: number | null;
  }[]) {
    return post<ApiProductSchedule[]>(
      `/supplier/products/${productId}/schedules/batch`,
      { schedules },
      'supplier',
    );
  },

  /** 更新排期 */
  async updateSchedule(productId: number, scheduleId: number, data: {
    date?: string;
    time_slot?: string;
    total_slots?: number;
    price?: number | null;
  }) {
    return put<ApiProductSchedule>(
      `/supplier/products/${productId}/schedules/${scheduleId}`,
      data,
      'supplier',
    );
  },

  /** 删除排期 */
  async deleteSchedule(productId: number, scheduleId: number) {
    return del<void>(`/supplier/products/${productId}/schedules/${scheduleId}`, 'supplier');
  },

  /** 批量操作产品（上架/下架/删除） */
  async batchAction(action: 'online' | 'offline' | 'delete', ids: number[]) {
    return post<{ results: Array<{ id: number; success: boolean; error?: string }> }>(
      '/supplier/products/batch',
      { action, product_ids: ids },
      'supplier',
    );
  },

  /** 批量删除排期 */
  async batchDeleteSchedules(productId: number, ids: number[]) {
    return post<{ deleted: number; has_bookings: number[] }>(
      `/supplier/products/${productId}/schedules/batch-delete`,
      { schedule_ids: ids },
      'supplier',
    );
  },

  /** 排期日历汇总 */
  async scheduleCalendar(productId: number, month: string) {
    return get<Array<{ date: string; total_slots: number; booked_slots: number; schedules: number }>>(
      `/supplier/products/${productId}/schedules/calendar?month=${month}`,
      'supplier',
    );
  },

  /** 库存预警 */
  async scheduleAlerts() {
    return get<{ low_stock: unknown[]; sold_out: unknown[] }>(
      '/supplier/schedules/alerts',
      'supplier',
    );
  },
};

export default supplierProductService;
