/**
 * Supplier Review Service
 */

import { get, post, type PaginatedResponse } from './api';

export interface ApiReview {
  id: number;
  order_id: number;
  user_id: number;
  supplier_id: number;
  product_id: number;
  rating: number;
  content: string;
  photos: string;
  status: string;
  reply: string;
  replied_at: string | null;
  replied_by: number | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
    avatar: string;
  };
  product?: {
    id: number;
    name_zh: string;
    name_en: string;
  };
}

export interface ReviewStats {
  total_reviews: number;
  avg_rating: number;
  replied_count: number;
  reply_rate: number;
  rating_5: number;
  rating_4: number;
  rating_3: number;
  rating_2: number;
  rating_1: number;
}

function buildParams(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export const supplierReviewService = {
  list: (params: {
    page?: number;
    page_size?: number;
    status?: string;
    rating?: number;
    has_reply?: string;
  } = {}) => {
    return get<PaginatedResponse<ApiReview>>(
      `/supplier/reviews${buildParams(params)}`,
      'supplier',
    );
  },

  getStats: () => {
    return get<ReviewStats>('/supplier/reviews/stats', 'supplier');
  },

  reply: (id: number, content: string) => {
    return post<ApiReview>(`/supplier/reviews/${id}/reply`, { reply: content }, 'supplier');
  },
};

export default supplierReviewService;
