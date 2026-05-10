/**
 * Tourism Agent Service
 * REQ-20260510-0002 · 南澳旅游 AI Agent · Phase 1 · 1F
 *
 * Front-end client for the embedded "✨ AI 生成" + "💰 AI 建议价格" actions
 * on product edit pages. Auth is supplier or admin (the only two roles that
 * have a product editor in this app).
 *
 * The /api/v1/ai/tourism/* group has its own 1/s burst-3 rate limiter on
 * the server side, so a chatty supplier hitting "AI 生成" 5 times in a row
 * gets 429s back without affecting other AI scenes — the UI should show
 * those as a friendly "稍等再试" message rather than a generic error.
 */

import { post } from './api';

// ---------------------------------------------------------------------------
// generate-content
// ---------------------------------------------------------------------------

export type TourismGenerateField =
  | 'title'
  | 'description'
  | 'highlights'
  | 'itinerary';

export interface TourismGenerateSkeleton {
  category?: string;
  council?: string;
  duration_minutes?: number;
  highlights?: string[];
  tags?: string[];
}

export interface TourismGenerateRequest {
  field: TourismGenerateField;
  /** Defaults to zh-CN on the server when omitted. */
  language?: 'zh-CN' | 'en-US';
  skeleton?: TourismGenerateSkeleton;
}

/**
 * KnowledgeRef points to a tourism_* row the agent visited via tools while
 * composing this answer. The UI can show "based on N entries" without
 * trusting any IDs the LLM may have mentioned in prose (D3 guarantee on
 * the backend).
 */
export interface TourismKnowledgeRef {
  type: string;
  id: number;
  name: string;
}

export interface TourismGenerateResponse {
  field: TourismGenerateField;
  content: string;
  knowledge_refs: TourismKnowledgeRef[];
}

// ---------------------------------------------------------------------------
// pricing-suggest
// ---------------------------------------------------------------------------

export interface TourismPricingRequest {
  category: string;
  council: string;
  duration_minutes: number;
  /** Defaults to year_round on the server when omitted. */
  season?: 'year_round' | 'spring' | 'summer' | 'autumn' | 'winter';
}

export interface TourismPricingResponse {
  median?: number;
  p25?: number;
  p75?: number;
  sample_size: number;
  currency: string;
  /** insufficient | low | normal | high (D4). */
  confidence: string;
  explanation?: string;
  insufficient_data?: boolean;
}

// ---------------------------------------------------------------------------
// service object
// ---------------------------------------------------------------------------
//
// userType selection: the request can be authenticated as supplier OR admin.
// We let the caller decide so the same service works on both editors.

type EditorRole = 'supplier' | 'admin';

// REQ-20260510-0011 Phase 2 dev-2A — C-end browsing aids ("📍 周边还有什么").
// Mounted under a separate /api/v1/ai/tourism/* sub-group with a 6 r/min/IP
// limiter, no auth requirement. Cached server-side 24h since KB content
// changes slowly and the result is the same for every visitor on a product.
export interface TourismNearbyRequest {
  category: string;
  council: string;
  exclude_product_id?: number;
  limit?: number; // server caps at 5
}

export interface TourismNearbyItem {
  type: string; // attraction | accommodation | food | experience
  id: number;
  name_zh: string;
  name_en?: string;
  council?: string;
}

export interface TourismNearbyResponse {
  items: TourismNearbyItem[];
  cached: boolean;
}

export const tourismAgentService = {
  generateContent(req: TourismGenerateRequest, role: EditorRole) {
    return post<TourismGenerateResponse>(
      '/ai/tourism/generate-content',
      req,
      role,
    );
  },
  pricingSuggest(req: TourismPricingRequest, role: EditorRole) {
    return post<TourismPricingResponse>(
      '/ai/tourism/pricing-suggest',
      req,
      role,
    );
  },
  /**
   * REQ-20260510-0011 dev-2A: fetch nearby KB entries for the C-end
   * "📍 周边还有什么" button. No auth (public endpoint), no role param.
   */
  nearby(req: TourismNearbyRequest) {
    return post<TourismNearbyResponse>('/ai/tourism/nearby', req);
  },
};
