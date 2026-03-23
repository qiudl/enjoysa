/**
 * Hotel Service
 * 酒店搜索 API（公开接口，无需认证）
 */

import { get } from './api';
import type { ApiProduct } from './productService';

export interface HotelFilter {
  region_id?: number;
  keyword?: string;
  min_price?: number;
  max_price?: number;
  star_rating?: string; // comma-separated: "3,4,5"
  accommodation_type?: string; // comma-separated
  facilities?: string; // comma-separated
  sort_by?: 'recommend' | 'price_asc' | 'price_desc' | 'rating';
  page?: number;
  page_size?: number;
}

export interface HotelMetadata {
  star_rating: number;
  accommodation_type: string;
  facilities: string[];
  room_types: {
    name_zh: string;
    name_en: string;
    bed_type: string;
    max_guests: number;
    price: number;
  }[];
  total_rooms: number;
  check_in_time: string;
  check_out_time: string;
  distance_to_center: number;
}

export interface HotelSearchResponse {
  items: ApiProduct[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

function buildHotelParams(filter: HotelFilter): string {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 0) {
      params.append(key, String(value));
    }
  });
  const str = params.toString();
  return str ? `?${str}` : '';
}

export const hotelService = {
  async search(filter: HotelFilter = {}): Promise<HotelSearchResponse> {
    return get<HotelSearchResponse>(`/hotels/search${buildHotelParams(filter)}`);
  },
};

export default hotelService;
