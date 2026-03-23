/**
 * Supplier Notification Service
 */

import { get, post, del, type PaginatedResponse } from './api';

export interface ApiNotification {
  id: number;
  recipient_type: string;
  recipient_id: number;
  type: string;
  title: string;
  content: string;
  related_type: string;
  related_id: number;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

function buildParams(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export const supplierNotificationService = {
  list: (params: {
    page?: number;
    page_size?: number;
    is_read?: string;
  } = {}) => {
    return get<PaginatedResponse<ApiNotification>>(
      `/supplier/notifications${buildParams(params)}`,
      'supplier',
    );
  },

  getUnreadCount: () => {
    return get<{ count: number }>('/supplier/notifications/unread-count', 'supplier');
  },

  markRead: (id: number) => {
    return post<void>(`/supplier/notifications/${id}/read`, undefined, 'supplier');
  },

  markAllRead: () => {
    return post<void>('/supplier/notifications/read-all', undefined, 'supplier');
  },

  delete: (id: number) => {
    return del<void>(`/supplier/notifications/${id}`, 'supplier');
  },
};

export default supplierNotificationService;
