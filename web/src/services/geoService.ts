/**
 * Geo Service
 * REQ-20260506-0006: anonymous lookup of the request's country so the UI can
 * decide whether to render Google login (Google is unreachable in mainland CN).
 *
 * The endpoint is unauthenticated, so we don't go through the regular
 * `request()` helper — that pulls in token logic we don't need here, and
 * keeping geo separate means a transient auth bug can never knock out region
 * detection.
 */

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

export interface GeoInfo {
  country: string;
  region: string;
  is_blocked_region: boolean;
  google_disabled: boolean;
}

const ZERO_GEO: GeoInfo = {
  country: '',
  region: '',
  is_blocked_region: false,
  google_disabled: false,
};

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch the current request's geo info. On any error (network, 5xx, malformed
 * payload, timeout) returns a zero GeoInfo so callers default to "show
 * Google login" — we never want to gate UX on a fragile network call.
 */
export async function fetchGeo(timeoutMs = 3000): Promise<GeoInfo> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${API_BASE}/geo`, { signal: ctrl.signal });
    if (!resp.ok) return ZERO_GEO;
    const json: ApiEnvelope<GeoInfo> = await resp.json();
    if (!json.success || !json.data) return ZERO_GEO;
    return json.data;
  } catch {
    return ZERO_GEO;
  } finally {
    clearTimeout(timer);
  }
}
