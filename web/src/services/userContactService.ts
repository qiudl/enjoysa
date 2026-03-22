/**
 * User Contact Service
 * 常用联系人 CRUD API
 */

import { get, post, put, del, type ApiResponse } from './api';

export interface UserContact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  nationality: string;
  passport_number: string; // masked: ****1234
  default_type: 'adult' | 'child' | 'infant';
  is_self: boolean;
  special_requirements: string;
}

export interface ContactInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  nationality?: string;
  passport_number?: string;
  default_type?: 'adult' | 'child' | 'infant';
  is_self?: boolean;
  special_requirements?: string;
}

interface ContactListResponse {
  contacts: UserContact[];
  total: number;
  limit: number;
}

export async function listContacts(): Promise<UserContact[]> {
  const res = await get<ApiResponse<ContactListResponse>>('/auth/contacts', 'user');
  return res.data?.contacts || [];
}

export async function createContact(input: ContactInput): Promise<UserContact> {
  const res = await post<ApiResponse<UserContact>>('/auth/contacts', input, 'user');
  return res.data!;
}

export async function updateContact(id: number, input: ContactInput): Promise<UserContact> {
  const res = await put<ApiResponse<UserContact>>(`/auth/contacts/${id}`, input, 'user');
  return res.data!;
}

export async function deleteContact(id: number): Promise<void> {
  await del<ApiResponse>(`/auth/contacts/${id}`, 'user');
}

export async function upsertContact(input: ContactInput): Promise<void> {
  await post<ApiResponse>('/auth/contacts/upsert', input, 'user');
}
