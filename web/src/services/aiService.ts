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
