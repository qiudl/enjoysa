/**
 * Tourism Knowledge Service
 * REQ-20260510-0002 · 南澳旅游 AI Agent · Phase 1 · 1D
 *
 * Admin-side CRUD client for the 5 tourism knowledge tables. Mirrors the
 * shape of the backend response in pkg/response (PaginatedData wraps every
 * list endpoint).
 */

import { get, post, put, del } from './api';
import type { PaginatedResponse } from './api';

// ============================================================================
// Shared filter shapes
// ============================================================================

export interface PageQuery {
  page?: number;
  page_size?: number;
}

function toQueryString(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

// ============================================================================
// Attractions
// ============================================================================

export interface ApiAttraction {
  id: number;
  created_at: string;
  updated_at: string;
  name_zh: string;
  name_en?: string;
  council?: string;
  category?: string;
  tags: string[];
  price_range_min?: number;
  price_range_max?: number;
  typical_duration_minutes?: number;
  best_seasons: string[];
  description?: string;
  source?: string;
  source_ref?: string;
  is_active: boolean;
}

export interface AttractionPayload {
  name_zh: string;
  name_en?: string;
  council?: string;
  category?: string;
  tags?: string[];
  price_range_min?: number | null;
  price_range_max?: number | null;
  typical_duration_minutes?: number | null;
  best_seasons?: string[];
  description?: string;
  source?: string;
  source_ref?: string;
  is_active?: boolean;
}

export interface AttractionFilter extends PageQuery {
  council?: string;
  category?: string;
  keywords?: string;
  is_active?: boolean;
}

// ============================================================================
// Accommodations
// ============================================================================

export interface ApiAccommodation {
  id: number;
  created_at: string;
  updated_at: string;
  name_zh: string;
  name_en?: string;
  council?: string;
  star_rating?: number;
  price_range_min?: number;
  price_range_max?: number;
  room_types: string[];
  features: string[];
  address?: string;
  source?: string;
  source_ref?: string;
  is_active: boolean;
}

export interface AccommodationPayload {
  name_zh: string;
  name_en?: string;
  council?: string;
  star_rating?: number | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  room_types?: string[];
  features?: string[];
  address?: string;
  source?: string;
  source_ref?: string;
  is_active?: boolean;
}

export interface AccommodationFilter extends PageQuery {
  council?: string;
  keywords?: string;
  is_active?: boolean;
}

// ============================================================================
// Food
// ============================================================================

export interface ApiFood {
  id: number;
  created_at: string;
  updated_at: string;
  name_zh: string;
  name_en?: string;
  council?: string;
  cuisine?: string;
  price_range_min?: number;
  price_range_max?: number;
  signature_dishes: string[];
  address?: string;
  source?: string;
  source_ref?: string;
  is_active: boolean;
}

export interface FoodPayload {
  name_zh: string;
  name_en?: string;
  council?: string;
  cuisine?: string;
  price_range_min?: number | null;
  price_range_max?: number | null;
  signature_dishes?: string[];
  address?: string;
  source?: string;
  source_ref?: string;
  is_active?: boolean;
}

export interface FoodFilter extends PageQuery {
  council?: string;
  cuisine?: string;
  keywords?: string;
  is_active?: boolean;
}

// ============================================================================
// Experiences
// ============================================================================

export interface ApiExperience {
  id: number;
  created_at: string;
  updated_at: string;
  name_zh: string;
  name_en?: string;
  council?: string;
  category?: string;
  price_range_min?: number;
  price_range_max?: number;
  typical_duration_minutes?: number;
  best_seasons: string[];
  description?: string;
  source?: string;
  source_ref?: string;
  is_active: boolean;
}

export interface ExperiencePayload {
  name_zh: string;
  name_en?: string;
  council?: string;
  category?: string;
  price_range_min?: number | null;
  price_range_max?: number | null;
  typical_duration_minutes?: number | null;
  best_seasons?: string[];
  description?: string;
  source?: string;
  source_ref?: string;
  is_active?: boolean;
}

export interface ExperienceFilter extends PageQuery {
  council?: string;
  category?: string;
  keywords?: string;
  is_active?: boolean;
}

// ============================================================================
// Pricing benchmarks
// ============================================================================

export type DurationBucket = 'half_day' | 'full_day' | 'multi_day';
export type Season = 'year_round' | 'spring' | 'summer' | 'autumn' | 'winter';

export interface ApiPricingBenchmark {
  id: number;
  created_at: string;
  updated_at: string;
  category: string;
  council: string;
  duration_bucket: DurationBucket;
  season: Season;
  median_price?: number;
  p25?: number;
  p75?: number;
  sample_size: number;
  currency: string;
  computed_at?: string;
}

export interface PricingBenchmarkPayload {
  category: string;
  council: string;
  duration_bucket: DurationBucket;
  season?: Season;
  median_price?: number | null;
  p25?: number | null;
  p75?: number | null;
  sample_size?: number;
  currency?: string;
}

export interface PricingBenchmarkFilter extends PageQuery {
  category?: string;
  council?: string;
  duration_bucket?: DurationBucket;
  season?: Season;
}

// ============================================================================
// Service object — one CRUD set per entity, all under /admin/tourism/*.
// Lists return PaginatedResponse<T>; getters and writers return the row.
// ============================================================================

export const tourismKnowledgeService = {
  // --- Attractions ---
  listAttractions(f: AttractionFilter = {}) {
    return get<PaginatedResponse<ApiAttraction>>(`/admin/tourism/attractions${toQueryString(f as Record<string, unknown>)}`, 'admin');
  },
  getAttraction(id: number) {
    return get<ApiAttraction>(`/admin/tourism/attractions/${id}`, 'admin');
  },
  createAttraction(payload: AttractionPayload) {
    return post<ApiAttraction>('/admin/tourism/attractions', payload, 'admin');
  },
  updateAttraction(id: number, payload: AttractionPayload) {
    return put<ApiAttraction>(`/admin/tourism/attractions/${id}`, payload, 'admin');
  },
  deleteAttraction(id: number) {
    return del<void>(`/admin/tourism/attractions/${id}`, 'admin');
  },

  // --- Accommodations ---
  listAccommodations(f: AccommodationFilter = {}) {
    return get<PaginatedResponse<ApiAccommodation>>(`/admin/tourism/accommodations${toQueryString(f as Record<string, unknown>)}`, 'admin');
  },
  getAccommodation(id: number) {
    return get<ApiAccommodation>(`/admin/tourism/accommodations/${id}`, 'admin');
  },
  createAccommodation(payload: AccommodationPayload) {
    return post<ApiAccommodation>('/admin/tourism/accommodations', payload, 'admin');
  },
  updateAccommodation(id: number, payload: AccommodationPayload) {
    return put<ApiAccommodation>(`/admin/tourism/accommodations/${id}`, payload, 'admin');
  },
  deleteAccommodation(id: number) {
    return del<void>(`/admin/tourism/accommodations/${id}`, 'admin');
  },

  // --- Food ---
  listFood(f: FoodFilter = {}) {
    return get<PaginatedResponse<ApiFood>>(`/admin/tourism/food${toQueryString(f as Record<string, unknown>)}`, 'admin');
  },
  getFood(id: number) {
    return get<ApiFood>(`/admin/tourism/food/${id}`, 'admin');
  },
  createFood(payload: FoodPayload) {
    return post<ApiFood>('/admin/tourism/food', payload, 'admin');
  },
  updateFood(id: number, payload: FoodPayload) {
    return put<ApiFood>(`/admin/tourism/food/${id}`, payload, 'admin');
  },
  deleteFood(id: number) {
    return del<void>(`/admin/tourism/food/${id}`, 'admin');
  },

  // --- Experiences ---
  listExperiences(f: ExperienceFilter = {}) {
    return get<PaginatedResponse<ApiExperience>>(`/admin/tourism/experiences${toQueryString(f as Record<string, unknown>)}`, 'admin');
  },
  getExperience(id: number) {
    return get<ApiExperience>(`/admin/tourism/experiences/${id}`, 'admin');
  },
  createExperience(payload: ExperiencePayload) {
    return post<ApiExperience>('/admin/tourism/experiences', payload, 'admin');
  },
  updateExperience(id: number, payload: ExperiencePayload) {
    return put<ApiExperience>(`/admin/tourism/experiences/${id}`, payload, 'admin');
  },
  deleteExperience(id: number) {
    return del<void>(`/admin/tourism/experiences/${id}`, 'admin');
  },

  // --- Pricing benchmarks ---
  listPricingBenchmarks(f: PricingBenchmarkFilter = {}) {
    return get<PaginatedResponse<ApiPricingBenchmark>>(`/admin/tourism/pricing-benchmarks${toQueryString(f as Record<string, unknown>)}`, 'admin');
  },
  getPricingBenchmark(id: number) {
    return get<ApiPricingBenchmark>(`/admin/tourism/pricing-benchmarks/${id}`, 'admin');
  },
  createPricingBenchmark(payload: PricingBenchmarkPayload) {
    return post<ApiPricingBenchmark>('/admin/tourism/pricing-benchmarks', payload, 'admin');
  },
  updatePricingBenchmark(id: number, payload: PricingBenchmarkPayload) {
    return put<ApiPricingBenchmark>(`/admin/tourism/pricing-benchmarks/${id}`, payload, 'admin');
  },
  deletePricingBenchmark(id: number) {
    return del<void>(`/admin/tourism/pricing-benchmarks/${id}`, 'admin');
  },
};
