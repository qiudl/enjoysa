import type { Region } from './types';
import { regions } from './regions';

export function getAllRegions(): Region[] {
  return regions;
}

export function getRegionById(id: string): Region | undefined {
  return regions.find((r) => r.id === id);
}

export { regions } from './regions';
export type {
  Region,
  Attraction,
  Highlight,
  Package,
  FAQ,
  AttractionTag,
} from './types';
