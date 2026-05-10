/**
 * Tourism C-end Service
 * REQ-20260510-0011 · 南澳旅游 AI Agent · Phase 2 · 2A
 *
 * Front-end client for the embedded "💡 AI 讲讲" / "🤔 适合我吗" / "📍 周边"
 * buttons on ProductDetailPage. Anonymous-friendly — these endpoints do
 * NOT require auth (anyone browsing a product detail page can use them).
 *
 * The dedicated 6 r/min/IP server-side limiter on /api/v1/ai/tourism/c/*
 * means rapid clicks return HTTP 429 with a retry-after; the UI should
 * surface that as a "稍等一下再试" toast rather than a generic error.
 */

import { get, post } from './api';

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface TourismKnowledgeRef {
  type: string;
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// /explain
// ---------------------------------------------------------------------------

export interface TourismExplainResponse {
  field: string;
  content: string;
  knowledge_refs: TourismKnowledgeRef[];
}

// ---------------------------------------------------------------------------
// /fit-check
// ---------------------------------------------------------------------------

export interface TourismFitCheckResponse {
  field: string;
  content: string;
  knowledge_refs: TourismKnowledgeRef[];
}

// ---------------------------------------------------------------------------
// /nearby
// ---------------------------------------------------------------------------

export interface TourismNearbyItem {
  type: string;
  id: number;
  name: string;
  name_en?: string;
  council?: string;
}

export interface TourismNearbyResponse {
  items: TourismNearbyItem[];
}

// ---------------------------------------------------------------------------
// service
// ---------------------------------------------------------------------------
//
// userType is intentionally omitted from these calls — the C-end endpoints
// accept anonymous traffic. Skipping userType means the api.ts base helper
// won't attach an Authorization header.

export const tourismCEndService = {
  explain(productId: number) {
    return post<TourismExplainResponse>('/ai/tourism/c/explain', {
      product_id: productId,
    });
  },
  fitCheck(productId: number, userQuery: string) {
    return post<TourismFitCheckResponse>('/ai/tourism/c/fit-check', {
      product_id: productId,
      user_query: userQuery,
    });
  },
  nearby(productId: number) {
    return get<TourismNearbyResponse>(
      `/ai/tourism/c/nearby?product_id=${encodeURIComponent(productId)}`,
    );
  },
};
