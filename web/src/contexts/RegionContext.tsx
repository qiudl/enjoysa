/**
 * RegionContext (REQ-20260506-0006)
 *
 * Reads /api/v1/geo once on mount and broadcasts the result to all consumers
 * so that components can hide Google-related UI when the visitor is in
 * mainland China (where Google services are unreachable). Result is cached
 * for 24h in sessionStorage so page-to-page navigation doesn't re-probe.
 *
 * The provider always renders its children — there is no loading gate.
 * `googleDisabled` defaults to false until the probe resolves, which means
 * Google login may flash visible for a few hundred ms in the worst case;
 * that's preferable to delaying first paint.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { fetchGeo, type GeoInfo } from '../services/geoService';

interface RegionContextValue extends GeoInfo {
  loaded: boolean;
}

const DEFAULT_VALUE: RegionContextValue = {
  country: '',
  region: '',
  is_blocked_region: false,
  google_disabled: false,
  loaded: false,
};

const RegionContext = createContext<RegionContextValue>(DEFAULT_VALUE);

const CACHE_KEY = 'enjoysa_geo_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  geo: GeoInfo;
  expiresAt: number;
}

function readCache(): GeoInfo | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CacheEntry = JSON.parse(raw);
    if (!parsed.geo || typeof parsed.expiresAt !== 'number') return null;
    if (Date.now() > parsed.expiresAt) return null;
    return parsed.geo;
  } catch {
    return null;
  }
}

function writeCache(geo: GeoInfo) {
  try {
    const entry: CacheEntry = { geo, expiresAt: Date.now() + CACHE_TTL_MS };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore quota / disabled storage — geo is best-effort.
  }
}

export function RegionProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<RegionContextValue>(() => {
    const cached = readCache();
    if (cached) {
      return { ...cached, loaded: true };
    }
    return DEFAULT_VALUE;
  });

  useEffect(() => {
    if (value.loaded) return;
    let cancelled = false;
    fetchGeo().then((geo) => {
      if (cancelled) return;
      writeCache(geo);
      setValue({ ...geo, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, [value.loaded]);

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion(): RegionContextValue {
  return useContext(RegionContext);
}
