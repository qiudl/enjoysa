/**
 * Supplier Export Service
 * Downloads CSV files from the backend export API
 */

import { getAccessToken } from './api';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

async function downloadCsv(endpoint: string, params: Record<string, string> = {}): Promise<void> {
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE}${endpoint}${query ? '?' + query : ''}`;

  const token = getAccessToken('supplier');
  const resp = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!resp.ok) {
    // Try to parse JSON error
    try {
      const data = await resp.json();
      throw new Error(data.error || data.message || 'Export failed');
    } catch {
      throw new Error(`Export failed (${resp.status})`);
    }
  }

  const blob = await resp.blob();
  const disposition = resp.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename=(.+)/);
  const filename = match ? match[1] : 'export.csv';

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export const supplierExportService = {
  exportOrders: (startDate?: string, endDate?: string) => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return downloadCsv('/supplier/export/orders', params);
  },

  exportSettlements: (startDate?: string, endDate?: string) => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return downloadCsv('/supplier/export/settlements', params);
  },

  exportProducts: () => {
    return downloadCsv('/supplier/export/products');
  },
};

export default supplierExportService;
