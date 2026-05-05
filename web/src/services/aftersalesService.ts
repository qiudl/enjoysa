import { getAccessToken } from './api';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

export interface SupplierCreateTicketPayload {
  order_id: number;
  type: 'refund' | 'exchange' | 'complaint' | 'inquiry';
  priority?: 'low' | 'medium' | 'high';
  subject: string;
  description?: string;
  image_urls?: string[];
}

export interface CreateTicketResult {
  ticket: {
    id: number;
    ticket_no: string;
    type: string;
    status: string;
    subject: string;
  };
  image_count: number;
}

export interface TicketAttachment {
  id: number;
  ticket_id: number;
  file_url: string;
  file_name?: string;
  created_at: string;
}

export interface SupplierTicketDetail {
  ticket: {
    id: number;
    ticket_no: string;
    order_id?: number;
    type: string;
    status: string;
    priority: string;
    subject: string;
    description: string;
    source: string;
    created_at: string;
    updated_at: string;
    resolved_at?: string;
  };
  notes: Array<{
    id: number;
    ticket_id: number;
    author: string;
    content: string;
    is_system: boolean;
    created_at: string;
  }>;
  attachments: TicketAttachment[];
}

export async function createSupplierTicket(payload: SupplierCreateTicketPayload): Promise<CreateTicketResult> {
  const token = getAccessToken('supplier');
  if (!token) throw new Error('Sign in required');
  const res = await fetch(`${API_BASE}/supplier/aftersales/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Create failed (${res.status})`);
  }
  return data?.data as CreateTicketResult;
}

export async function getSupplierTicket(id: number): Promise<SupplierTicketDetail | null> {
  const token = getAccessToken('supplier');
  if (!token) return null;
  const res = await fetch(`${API_BASE}/supplier/aftersales/tickets/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.data as SupplierTicketDetail) ?? null;
}

/**
 * Upload a single image (compressed/COS) and return the public URL. Reuses
 * the AI image upload endpoint which is already wired up for supplier auth.
 */
export async function uploadTicketImage(file: File): Promise<string> {
  const token = getAccessToken('supplier');
  if (!token) throw new Error('Sign in required');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/ai/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  const url = data?.data?.url;
  if (!res.ok || !url) {
    throw new Error(data?.error || 'Upload failed');
  }
  return url as string;
}
