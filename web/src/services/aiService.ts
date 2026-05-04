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
