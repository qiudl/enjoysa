/**
 * Product Service
 * 产品浏览 API（公开接口，无需认证）
 */

import { get } from './api';
import type { Product, ProductTag } from '../types';

// 后端产品图片
export interface ApiProductImage {
  id: number;
  product_id: number;
  url: string;
  sort_order: number;
  is_cover: boolean;
}

// 后端产品套餐
export interface ApiProductPackage {
  id: number;
  product_id: number;
  name_zh: string;
  name_en: string;
  desc_zh: string;
  desc_en: string;
  price: number;
  // REQ-20260509-0035: -1 = 无限量；前端按 (stock_total - stock_sold) 算 remaining。
  stock_total?: number;
  stock_sold?: number;
  // REQ-20260510-0004: 0 = 关闭；>0 触发 inventory_low 通知阈值。
  low_stock_threshold?: number;
}

// 后端产品亮点
export interface ApiProductHighlight {
  id: number;
  product_id: number;
  title_zh: string;
  title_en: string;
  desc_zh: string;
  desc_en: string;
}

// 后端产品FAQ
export interface ApiProductFAQ {
  id: number;
  product_id: number;
  question_zh: string;
  question_en: string;
  answer_zh: string;
  answer_en: string;
}

// 后端产品排期
export interface ApiProductSchedule {
  id: number;
  product_id: number;
  package_id: number;
  date: string;
  time_slot: string;
  total_slots: number;
  booked_slots: number;
  price: number;
  status: string;
}

// 后端产品响应
export interface ApiProduct {
  id: number;
  name_zh: string;
  name_en: string;
  supplier_id: number;
  region_id: number;
  category_id: number;
  status: string;
  price_from: number;
  currency: string;
  summary_zh: string;
  summary_en: string;
  description_zh: string;
  description_en: string;
  address_zh: string;
  address_en: string;
  duration: string;
  group_size: string;
  tags: string;
  is_featured: boolean;
  rating: number;
  review_count: number;
  // REQ-20260509-0015 + REQ-20260510-0001 dev-4: bilateral "human edit lock"
  // flags. When either side is true, the AI auto-fill / re-translate path
  // skips that side so it can't clobber the manual entry. Backend writes
  // them via the inline-edit PATCH (manual-override) endpoint and the
  // 0015 Re-translate flow.
  manual_override_zh?: boolean;
  manual_override_en?: boolean;
  supplier?: {
    id: number;
    name: string;
    type: string;
  };
  region?: {
    id: number;
    slug: string;
    name_zh: string;
    name_en: string;
  };
  category?: {
    id: number;
    slug: string;
    name_zh: string;
    name_en: string;
  };
  images?: ApiProductImage[];
  packages?: ApiProductPackage[];
  highlights?: ApiProductHighlight[];
  faqs?: ApiProductFAQ[];
  metadata?: Record<string, unknown>;
  total_stock?: number;
  available_stock?: number;
  created_at: string;
  updated_at: string;
  // REQ-20260509-0019: 代录身份。created_via='admin_proxy' 时 supplier 端
  // 渲染 "Created by ${name} on ${date}" 提示条；name 由后端 admin 表查询填充。
  created_via?: 'supplier_self' | 'admin_proxy';
  created_by_admin_id?: number;
  created_by_admin_name?: string;
}

// 分页响应
interface PaginatedProductResponse {
  items: ApiProduct[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 产品列表过滤
export interface ProductFilter {
  page?: number;
  page_size?: number;
  region_id?: number;
  category_id?: number;
  keyword?: string;
}

function buildParams(filter: ProductFilter): string {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 0) {
      params.append(key, String(value));
    }
  });
  const str = params.toString();
  return str ? `?${str}` : '';
}

/** 将后端 ApiProduct 转换为前端 Product 类型 */
export function transformApiProduct(p: ApiProduct): Product {
  const coverImage = p.images?.find((img) => img.is_cover) || p.images?.[0];
  const images = p.images?.map((img) => img.url) || [];
  if (images.length === 0 && coverImage) {
    images.push(coverImage.url);
  }

  let parsedTags: ProductTag[] = [];
  try {
    const raw = typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : p.tags;
    if (Array.isArray(raw)) parsedTags = raw as ProductTag[];
  } catch {
    // ignore
  }

  return {
    id: String(p.id),
    title: p.name_zh,
    titleEn: p.name_en,
    description: p.description_zh || p.summary_zh,
    descriptionEn: p.description_en || p.summary_en,
    images,
    price: p.price_from,
    currency: (p.currency || 'AUD') as 'AUD' | 'CNY',
    rating: p.rating,
    reviewCount: p.review_count,
    location: p.address_zh,
    locationEn: p.address_en,
    duration: p.duration,
    highlights: p.highlights?.map((h) => h.title_zh) || [],
    highlightsEn: p.highlights?.map((h) => h.title_en) || [],
    inclusions: [],
    exclusions: [],
    category: p.category
      ? { id: p.category.slug, name: p.category.name_zh, nameEn: p.category.name_en }
      : { id: '', name: '', nameEn: '' },
    destination: p.region
      ? { id: p.region.slug, name: p.region.name_zh, nameEn: p.region.name_en, region: '南澳大利亚', regionEn: 'South Australia' }
      : { id: '', name: '', nameEn: '', region: '', regionEn: '' },
    tags: parsedTags,
    availability: p.status !== 'approved'
      ? 'limited'
      : p.available_stock !== undefined && p.available_stock <= 0
        ? 'sold_out'
        : p.available_stock !== undefined && p.available_stock < 5
          ? 'limited'
          : 'available',
    instantConfirmation: true,
    freeCancellation: true,
    supplierId: String(p.supplier_id),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export const productService = {
  /** 产品列表（分页） */
  async list(filter: ProductFilter = {}): Promise<PaginatedProductResponse> {
    return get<PaginatedProductResponse>(`/products${buildParams(filter)}`);
  },

  /** 推荐产品 */
  async featured(): Promise<ApiProduct[]> {
    return get<ApiProduct[]>('/products/featured');
  },

  /** 产品详情 */
  async getById(id: number): Promise<ApiProduct> {
    return get<ApiProduct>(`/products/${id}`);
  },

  /** 产品排期（未来60天） */
  async getSchedules(id: number): Promise<ApiProductSchedule[]> {
    return get<ApiProductSchedule[]>(`/products/${id}/schedules`);
  },
};

// 供应商公开信息
export interface ApiSupplierProfile {
  id: number;
  name: string;
  type: string;
  description: string;
  logo: string;
  phone: string;
  website: string;
  city: string;
  state: string;
  country: string;
  rating: number;
  review_count: number;
  product_count: number;
}

export const supplierPublicService = {
  /** 获取供应商公开信息 */
  async getProfile(id: number): Promise<ApiSupplierProfile> {
    return get<ApiSupplierProfile>(`/suppliers/${id}`);
  },

  /** 获取供应商产品列表 */
  async getProducts(id: number, filter: ProductFilter = {}): Promise<PaginatedProductResponse> {
    const params = buildParams(filter);
    return get<PaginatedProductResponse>(`/suppliers/${id}/products${params}`);
  },
};

export default productService;
