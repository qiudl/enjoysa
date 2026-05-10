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

export type TourismLang = 'zh-CN' | 'en-US';

export const tourismCEndService = {
  // REQ-20260510-0014: language passes through to LLM. Optional — backend
  // defaults to zh-CN when omitted, so callers from before #14 keep working.
  explain(productId: number, language?: TourismLang) {
    return post<TourismExplainResponse>('/ai/tourism/c/explain', {
      product_id: productId,
      language,
    });
  },
  fitCheck(productId: number, userQuery: string, language?: TourismLang) {
    return post<TourismFitCheckResponse>('/ai/tourism/c/fit-check', {
      product_id: productId,
      user_query: userQuery,
      language,
    });
  },
  nearby(productId: number) {
    // No language — pure DB read, no LLM call (REQ-20260510-0014 R5 scope note).
    return get<TourismNearbyResponse>(
      `/ai/tourism/c/nearby?product_id=${encodeURIComponent(productId)}`,
    );
  },
};

// ---------------------------------------------------------------------------
// 2B · /draft-reply (supplier or admin auth)
// ---------------------------------------------------------------------------
//
// Lives in this file even though it's "supplier-side" — same tourism agent
// stack, just gated by hasEditorIdentity on the server. Caller picks which
// auth context to send via the role param.

export interface TourismDraftReplyResponse {
  field: string;
  content: string;
  knowledge_refs: TourismKnowledgeRef[];
}

type EditorRole = 'supplier' | 'admin';

export const tourismSupplierService = {
  // REQ-20260510-0014: language optional, defaults to zh-CN server-side.
  // Pass the editor's current i18n locale so the draft matches the
  // supplier-facing UI language.
  draftReply(ticketId: number, role: EditorRole, language?: TourismLang) {
    return post<TourismDraftReplyResponse>(
      '/ai/tourism/draft-reply',
      { ticket_id: ticketId, language },
      role,
    );
  },
};
