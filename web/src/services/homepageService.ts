/**
 * Homepage CMS Service
 */
import { get, post, put, del } from './api';

// Modules created via the "Add CustomBlock" UI use this key prefix. The
// backend (homepage.CustomBlockKeyPrefix) and the HomePage renderer both
// gate on this constant — change it here AND in handler.go together.
export const CUSTOM_BLOCK_KEY_PREFIX = 'custom_block_';

export interface CustomBlockConfig {
  title_zh: string;
  title_en: string;
  desc_zh?: string;
  desc_en?: string;
  image_url?: string;
  cta_text_zh?: string;
  cta_text_en?: string;
  cta_link?: string;
}

// === Types ===

export interface HomepageModule {
  id: number;
  module_key: string;
  title_zh: string;
  title_en: string;
  sort_order: number;
  is_visible: boolean;
  config: Record<string, unknown>;
}

export interface HomepageFeature {
  id: number;
  icon: string;
  title_zh: string;
  title_en: string;
  desc_zh: string;
  desc_en: string;
  sort_order: number;
  status: string;
}

export interface HomepageTestimonial {
  id: number;
  source: string;
  author_name: string;
  author_avatar: string;
  content_zh: string;
  content_en: string;
  rating: number;
  product_name_zh: string;
  product_name_en: string;
  sort_order: number;
  status: string;
}

export interface HomepagePartner {
  id: number;
  name: string;
  logo: string;
  website: string;
  sort_order: number;
  status: string;
}

export interface PopularProduct {
  id: number;
  name_zh: string;
  name_en: string;
  image: string;
  price_from: number;
  currency: string;
  rating: number;
  order_count: number;
}

export interface HomepageConfig {
  modules: HomepageModule[];
  features: HomepageFeature[];
  testimonials: HomepageTestimonial[];
  partners: HomepagePartner[];
  popular_products: PopularProduct[];
}

// === Public API ===

export const homepagePublicService = {
  async getConfig(): Promise<HomepageConfig> {
    return get<HomepageConfig>('/homepage/config');
  },
};

// === Admin API ===

export const homepageAdminService = {
  // Features
  async listFeatures(): Promise<HomepageFeature[]> {
    return get<HomepageFeature[]>('/admin/homepage/features');
  },
  async createFeature(data: Omit<HomepageFeature, 'id'>): Promise<HomepageFeature> {
    return post<HomepageFeature>('/admin/homepage/features', data);
  },
  async updateFeature(id: number, data: Partial<HomepageFeature>): Promise<HomepageFeature> {
    return put<HomepageFeature>(`/admin/homepage/features/${id}`, data);
  },
  async deleteFeature(id: number): Promise<void> {
    return del(`/admin/homepage/features/${id}`);
  },

  // Testimonials
  async listTestimonials(): Promise<HomepageTestimonial[]> {
    return get<HomepageTestimonial[]>('/admin/homepage/testimonials');
  },
  async createTestimonial(data: Omit<HomepageTestimonial, 'id'>): Promise<HomepageTestimonial> {
    return post<HomepageTestimonial>('/admin/homepage/testimonials', data);
  },
  async syncTestimonials(): Promise<{ synced: number }> {
    return post<{ synced: number }>('/admin/homepage/testimonials/sync', {});
  },
  async updateTestimonial(id: number, data: Partial<HomepageTestimonial>): Promise<HomepageTestimonial> {
    return put<HomepageTestimonial>(`/admin/homepage/testimonials/${id}`, data);
  },
  async deleteTestimonial(id: number): Promise<void> {
    return del(`/admin/homepage/testimonials/${id}`);
  },

  // Partners
  async listPartners(): Promise<HomepagePartner[]> {
    return get<HomepagePartner[]>('/admin/homepage/partners');
  },
  async createPartner(data: Omit<HomepagePartner, 'id'>): Promise<HomepagePartner> {
    return post<HomepagePartner>('/admin/homepage/partners', data);
  },
  async updatePartner(id: number, data: Partial<HomepagePartner>): Promise<HomepagePartner> {
    return put<HomepagePartner>(`/admin/homepage/partners/${id}`, data);
  },
  async deletePartner(id: number): Promise<void> {
    return del(`/admin/homepage/partners/${id}`);
  },

  // Modules
  async listModules(): Promise<HomepageModule[]> {
    return get<HomepageModule[]>('/admin/homepage/modules');
  },
  async updateModules(items: Array<{ id: number; title_zh: string; title_en: string; sort_order: number; is_visible: boolean }>): Promise<HomepageModule[]> {
    return put<HomepageModule[]>('/admin/homepage/modules', items);
  },
  async createCustomBlock(input: {
    title_zh: string;
    title_en: string;
    config: CustomBlockConfig;
    sort_order?: number;
    is_visible?: boolean;
  }): Promise<HomepageModule> {
    return post<HomepageModule>('/admin/homepage/modules', {
      title_zh: input.title_zh,
      title_en: input.title_en,
      sort_order: input.sort_order ?? 9000,
      is_visible: input.is_visible ?? true,
      config: JSON.stringify(input.config),
    });
  },
  async deleteModule(moduleKey: string): Promise<void> {
    return del(`/admin/homepage/modules/${encodeURIComponent(moduleKey)}`);
  },
};
