/**
 * Region Service
 * 区域数据 API，将后端 snake_case 响应转换为前端 camelCase 类型
 */

import { get } from './api';
import type { Region } from '../data/types';
import type { ApiProduct } from './productService';

// 后端 Region 响应类型（导出供表单使用）
export interface ApiRegion {
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
}

// 后端 Category 响应类型（导出供表单使用）
export interface ApiCategory {
  id: number;
  slug: string;
  name_zh: string;
  name_en: string;
  icon: string;
  sort_order: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  icon: string;
}

/** 将后端 Region 转换为前端 Region 类型 */
function transformRegion(r: ApiRegion): Region {
  return {
    id: r.slug,
    name: r.name_zh,
    nameEn: r.name_en,
    description: r.desc_zh,
    descriptionEn: r.desc_en,
    tagline: r.tagline_zh,
    taglineEn: r.tagline_en,
    image: r.image,
    attractionCount: r.attraction_count,
  };
}

/** 将后端 Category 转换为前端 Category 类型 */
function transformCategory(c: ApiCategory): Category {
  return {
    id: c.slug,
    slug: c.slug,
    name: c.name_zh,
    nameEn: c.name_en,
    icon: c.icon,
  };
}

export const regionService = {
  /** 获取所有区域 */
  async getAll(): Promise<Region[]> {
    const data = await get<ApiRegion[]>('/regions');
    return data.map(transformRegion);
  },

  /** 获取区域原始数据（含数字 ID，供表单下拉选择用） */
  async getAllRaw(): Promise<ApiRegion[]> {
    return get<ApiRegion[]>('/regions');
  },

  /** 获取分类原始数据（含数字 ID，供表单下拉选择用） */
  async getCategoriesRaw(): Promise<ApiCategory[]> {
    return get<ApiCategory[]>('/categories');
  },

  /** 获取区域详情（含产品） */
  async getBySlug(slug: string): Promise<{ region: Region; products: ApiProduct[] }> {
    const data = await get<{ region: ApiRegion; products: ApiProduct[] }>(`/regions/${slug}`);
    return {
      region: transformRegion(data.region),
      products: data.products || [],
    };
  },

  /** 获取所有分类 */
  async getCategories(): Promise<Category[]> {
    const data = await get<ApiCategory[]>('/categories');
    return data.map(transformCategory);
  },
};

export default regionService;
