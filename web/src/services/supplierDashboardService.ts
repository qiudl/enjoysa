/**
 * Supplier Dashboard Service
 * 供应商仪表盘增强 API
 */

import { get } from './api';

export interface RevenueTrendItem {
  date: string;
  revenue: number;
  order_count: number;
}

export interface TopProductItem {
  product_id: number;
  product_name: string;
  order_count: number;
  revenue: number;
  guest_count: number;
}

export interface ChannelStatsItem {
  channel: string;
  order_count: number;
  revenue: number;
}

export interface EnhancedStats {
  today_revenue: number;
  week_revenue: number;
  month_revenue: number;
  today_orders: number;
  month_total: number;
  month_cancelled: number;
  avg_order_value: number;
}

export interface ScheduleAlert {
  id: number;
  product_id: number;
  date: string;
  time_slot: string;
  total_slots: number;
  booked_slots: number;
  status: string;
  product_name?: string;
}

export interface ScheduleAlerts {
  low_stock: ScheduleAlert[];
  sold_out: ScheduleAlert[];
}

export async function getRevenueTrend(days = 30): Promise<RevenueTrendItem[]> {
  return get<RevenueTrendItem[]>(`/supplier/dashboard/revenue-trend?days=${days}`, 'supplier');
}

export async function getTopProducts(days = 30, limit = 5): Promise<TopProductItem[]> {
  return get<TopProductItem[]>(`/supplier/dashboard/top-products?days=${days}&limit=${limit}`, 'supplier');
}

export async function getChannelStats(days = 30): Promise<ChannelStatsItem[]> {
  return get<ChannelStatsItem[]>(`/supplier/dashboard/channel-stats?days=${days}`, 'supplier');
}

export async function getEnhancedStats(): Promise<EnhancedStats> {
  return get<EnhancedStats>('/supplier/dashboard/enhanced', 'supplier');
}

export async function getScheduleAlerts(): Promise<ScheduleAlerts> {
  return get<ScheduleAlerts>('/supplier/schedules/alerts', 'supplier');
}

export interface AuditLog {
  id: number;
  supplier_id: number;
  user_id: number;
  user_name: string;
  action: string;
  resource_type: string;
  resource_id: number;
  resource_name: string;
  detail: string;
  ip: string;
  user_agent: string;
  created_at: string;
}

export interface AuditLogList {
  items: AuditLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getAuditLogs(params: {
  page?: number;
  page_size?: number;
  action?: string;
  resource_type?: string;
} = {}): Promise<AuditLogList> {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.append(k, String(v));
  });
  const qs = sp.toString();
  return get<AuditLogList>(`/supplier/audit-logs${qs ? `?${qs}` : ''}`, 'supplier');
}
