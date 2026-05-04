/**
 * AI Service — API client for all AI-embedded features
 */

import { get, post } from './api';

// === Scene ① Smart Search ===

export interface SmartSearchIntent {
  tags: string[];
  parsed: string;
}

export interface SmartSearchProduct {
  id: number;
  name: string;
  summary: string;
  price_from: number;
  currency: string;
  rating: number;
  review_count: number;
  duration: string;
  region: string;
  image_url: string;
  url: string;
}

export interface SmartSearchResponse {
  intent: SmartSearchIntent;
  products: SmartSearchProduct[];
  tip: string;
}

export async function smartSearch(query: string, language = 'zh'): Promise<SmartSearchResponse | null> {
  try {
    const resp = await post<{ data: SmartSearchResponse }>('/ai/smart-search', { query, language });
    return resp.data;
  } catch {
    return null;
  }
}

// === Scene ② Parse Filters ===

export interface ParsedFilters {
  keyword?: string;
  region_id?: number;
  category_id?: number;
  tags?: string[];
  min_price?: number;
  max_price?: number;
  min_group_size?: number;
}

export interface ParseFiltersResponse {
  filters: ParsedFilters;
  display: string;
}

export async function parseFilters(query: string, language = 'zh'): Promise<ParseFiltersResponse | null> {
  try {
    const resp = await post<{ data: ParseFiltersResponse }>('/ai/parse-filters', { query, language });
    return resp.data;
  } catch {
    return null;
  }
}

// === Scene ③-A Product Q&A ===

export interface ProductQAResponse {
  answer: string;
  sources: string[];
}

export async function productQA(productId: number, question: string, language = 'zh'): Promise<ProductQAResponse | null> {
  try {
    const resp = await post<{ data: ProductQAResponse }>('/ai/product-qa', { product_id: productId, question, language });
    return resp.data;
  } catch {
    return null;
  }
}

export async function productQAFeedback(productId: number, question: string, answer: string, helpful: boolean): Promise<void> {
  await post('/ai/product-qa/feedback', { product_id: productId, question, answer, helpful }).catch(() => {});
}

// === Scene ③-B Product Fit ===

export interface FitItem {
  icon: string;
  text: string;
}

export interface ProductFitResponse {
  fit_items: FitItem[];
  recommendation: string;
}

export interface FitProfile {
  adults: number;
  children: number[];
}

export async function productFit(productId: number, profile: FitProfile, language = 'zh'): Promise<ProductFitResponse | null> {
  try {
    const resp = await post<{ data: ProductFitResponse }>('/ai/product-fit', { product_id: productId, profile, language });
    return resp.data;
  } catch {
    return null;
  }
}

// === Scene ③-C Review Summary ===

export interface ReviewSummaryResponse {
  positive_keywords: string[];
  negative_keywords: string[];
  best_for: string[];
  summary: string;
}

export async function reviewSummary(productId: number, language = 'zh'): Promise<ReviewSummaryResponse | null> {
  try {
    const resp = await get<{ data: ReviewSummaryResponse }>(`/ai/review-summary?product_id=${productId}&language=${language}`);
    return resp.data;
  } catch {
    return null;
  }
}

// === Scene ④ Itinerary Planning (SSE) ===

export interface ItineraryParams {
  travelers: { adults: number; children: number[] };
  days: number;
  preferences: string[];
  budget: number;
  language: string;
}

export interface SSEEvent {
  type: string;
  trace_id: string;
  seq: number;
  payload: { text?: string; elapsed_ms?: number };
}

/**
 * Stream itinerary planning via SSE. Calls onChunk for each text delta, onDone when complete.
 * Returns an AbortController for cancellation.
 */
export function planItineraryStream(
  params: ItineraryParams,
  onChunk: (text: string) => void,
  onDone: (elapsedMs: number) => void,
  onError: (msg: string) => void,
): AbortController {
  const controller = new AbortController();
  const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

  fetch(`${API_BASE}/ai/plan-itinerary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: controller.signal,
  })
    .then(async (resp) => {
      if (!resp.ok) {
        onError(`HTTP ${resp.status}`);
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) { onError('No body'); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt: SSEEvent = JSON.parse(line.slice(6));
            if (evt.type === 'content_delta' && evt.payload.text) {
              onChunk(evt.payload.text);
            } else if (evt.type === 'done') {
              onDone(evt.payload.elapsed_ms || 0);
            } else if (evt.type === 'error') {
              onError('AI service error');
            }
          } catch { /* skip */ }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onError(String(err));
    });

  return controller;
}

// === Scene ⑤ Cart Suggestions ===

export interface CartSuggestionsResponse {
  schedule_analysis: string;
  recommendations: { product_id: number; name: string; reason: string; price: number }[];
}

export async function cartSuggestions(items: { product_id: number; date?: string }[], language = 'zh'): Promise<CartSuggestionsResponse | null> {
  try {
    const resp = await post<{ data: CartSuggestionsResponse }>('/ai/cart-suggestions', { items, language });
    return resp.data;
  } catch { return null; }
}

// === Scene ⑥ Travel Reminder ===

export interface TravelReminderResponse {
  weather: string; clothing: string; meeting_point: string;
  items: string[]; highlight: string; voucher_tip: string;
}

export async function travelReminder(orderId: number, productId?: number, bookingDate?: string, language = 'zh'): Promise<TravelReminderResponse | null> {
  try {
    let url = `/ai/travel-reminder?order_id=${orderId}&language=${language}`;
    if (productId) url += `&product_id=${productId}`;
    if (bookingDate) url += `&booking_date=${bookingDate}`;
    const resp = await get<{ data: TravelReminderResponse }>(url);
    return resp.data;
  } catch { return null; }
}

// === Scene ⑦ Generate Product Content ===

export interface GeneratedContent {
  name_en: string; description_zh: string; description_en: string;
  highlights: { zh: string; en: string }[];
  faqs: { q_zh: string; a_zh: string; q_en: string; a_en: string }[];
  tags: string[];
}

export async function generateProductContent(nameZh: string, keywords: string): Promise<GeneratedContent | null> {
  try {
    const resp = await post<{ data: GeneratedContent }>('/ai/generate-product-content', { name_zh: nameZh, keywords }, 'supplier');
    return resp.data;
  } catch { return null; }
}

// === Scene ⑧ Supplier Briefing ===

export interface SupplierBriefingResponse {
  stats: { icon: string; text: string; trend: string; change: string }[];
  suggestion: string;
}

export async function supplierBriefing(): Promise<SupplierBriefingResponse | null> {
  try {
    const resp = await get<{ data: SupplierBriefingResponse }>('/ai/supplier-briefing', 'supplier');
    return resp.data;
  } catch { return null; }
}

// === Scene ⑨ Review Reply ===

export async function reviewReply(reviewText: string, rating: number, productName: string, reviewId?: number): Promise<string | null> {
  try {
    const resp = await post<{ data: { reply: string } }>('/ai/review-reply', { review_text: reviewText, rating, product_name: productName, review_id: reviewId }, 'supplier');
    return resp.data.reply;
  } catch { return null; }
}

// === Scene ⑩ Ticket Analysis ===

export interface TicketAnalysisResponse {
  intent: string;
  context: Record<string, string>;
  solutions: { label: string; detail: string; recommended?: boolean }[];
}

export async function ticketAnalysis(message: string, orderInfo?: string, ticketId?: number): Promise<TicketAnalysisResponse | null> {
  try {
    const resp = await post<{ data: TicketAnalysisResponse }>('/ai/ticket-analysis', { message, order_info: orderInfo, ticket_id: ticketId }, 'supplier');
    return resp.data;
  } catch { return null; }
}

// === Scene ⑪ Product Precheck ===

export interface ProductPrecheckResponse {
  score: number; risks: string[]; recommendation: string; ai_comment?: string;
}

export async function productPrecheck(productId: number): Promise<ProductPrecheckResponse | null> {
  try {
    const resp = await get<{ data: ProductPrecheckResponse }>(`/ai/product-precheck?product_id=${productId}`, 'admin');
    return resp.data;
  } catch { return null; }
}

// === Scene ⑫ Admin Insights ===

export interface AdminInsightsResponse {
  period: string; insights: string[]; alerts: string[];
}

export async function adminInsights(): Promise<AdminInsightsResponse | null> {
  try {
    const resp = await get<{ data: AdminInsightsResponse }>('/ai/admin-insights', 'admin');
    return resp.data;
  } catch { return null; }
}
