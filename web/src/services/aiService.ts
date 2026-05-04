/**
 * AI Service — API client for all AI-embedded features
 */

import { apiGet, apiPost } from './api';

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
    const resp = await apiPost<{ data: SmartSearchResponse }>('/ai/smart-search', { query, language });
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
    const resp = await apiPost<{ data: ProductQAResponse }>('/ai/product-qa', { product_id: productId, question, language });
    return resp.data;
  } catch {
    return null;
  }
}

export async function productQAFeedback(productId: number, question: string, answer: string, helpful: boolean): Promise<void> {
  await apiPost('/ai/product-qa/feedback', { product_id: productId, question, answer, helpful }).catch(() => {});
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
    const resp = await apiPost<{ data: ProductFitResponse }>('/ai/product-fit', { product_id: productId, profile, language });
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
    const resp = await apiGet<{ data: ReviewSummaryResponse }>(`/ai/review-summary?product_id=${productId}&language=${language}`);
    return resp.data;
  } catch {
    return null;
  }
}
