/**
 * Supplier Team Service
 */

import { get, post, put, del } from './api';

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
}

export interface TeamInvitation {
  id: number;
  supplier_id: number;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  invited_by: number;
  accepted_at: string | null;
  created_at: string;
}

export const supplierTeamService = {
  listMembers: () => {
    return get<TeamMember[]>('/supplier/team', 'supplier');
  },

  inviteMember: (data: { email: string; role: string; expiry: string }) => {
    return post<TeamInvitation>('/supplier/team/invite', data, 'supplier');
  },

  updateRole: (id: number, role: string) => {
    return put<void>(`/supplier/team/${id}/role`, { role }, 'supplier');
  },

  updateStatus: (id: number, status: string) => {
    return put<void>(`/supplier/team/${id}/status`, { status }, 'supplier');
  },

  removeMember: (id: number) => {
    return del<void>(`/supplier/team/${id}`, 'supplier');
  },

  resetPassword: (id: number) => {
    return post<{ temp_password: string }>(`/supplier/team/${id}/reset-password`, undefined, 'supplier');
  },

  listInvitations: () => {
    return get<TeamInvitation[]>('/supplier/team/invitations', 'supplier');
  },

  revokeInvitation: (id: number) => {
    return del<void>(`/supplier/team/invitations/${id}`, 'supplier');
  },

  resendInvitation: (id: number) => {
    return post<void>(`/supplier/team/invitations/${id}/resend`, undefined, 'supplier');
  },
};

export default supplierTeamService;
