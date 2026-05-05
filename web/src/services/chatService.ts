/**
 * Chat Service — AI Chat API + SSE streaming client
 * Connects to ai-service (售前 + 售后统一入口)
 */

import { getAccessToken, type UserType } from './api';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';
const AI_API_BASE = import.meta.env.VITE_AI_API_BASE || API_BASE;

export interface ChatMessage {
  id?: number;
  session_id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string;
  created_at?: string;
}

export interface ChatSession {
  id: number;
  title: string;
  language: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCallEvent {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResultEvent {
  id: string;
  name: string;
  result: string;
  duration_ms: number;
  success: boolean;
}

export interface StreamCallbacks {
  onSessionId: (sessionId: number) => void;
  onToken: (token: string) => void;
  onToolCall?: (toolCall: ToolCallEvent) => void;
  onToolResult?: (toolResult: ToolResultEvent) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

// === After-sales types ===

export interface Ticket {
  id: number;
  ticket_no: string;
  type: string;
  status: string;
  priority: string;
  subject: string;
  description?: string;
  created_at: string;
}

export interface IntentResult {
  intent: string;
  confidence: number;
  subIntent?: string;
  reasoning?: string;
}

/**
 * Get chat sessions for the current user.
 */
export async function getSessions(userType: UserType = 'user'): Promise<ChatSession[]> {
  const token = getAccessToken(userType);
  if (!token) return [];

  const response = await fetch(`${AI_API_BASE}/chat/sessions`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) return [];

  const data = await response.json();
  return data.data || [];
}

/**
 * Get messages for a specific session.
 */
export async function getMessages(sessionId: number, userType: UserType = 'user'): Promise<ChatMessage[]> {
  const token = getAccessToken(userType);
  if (!token) return [];

  const response = await fetch(`${AI_API_BASE}/chat/sessions/${sessionId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) return [];

  const data = await response.json();
  return data.data || [];
}

/**
 * Send a chat message with SSE streaming response.
 */
export async function sendMessageStream(
  message: string,
  callbacks: StreamCallbacks,
  options?: {
    sessionId?: number;
    language?: string;
    pageContext?: string;
    userType?: UserType;
    disabledTools?: string[];
  },
): Promise<void> {
  const userType = options?.userType || 'user';
  const token = getAccessToken(userType);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const body = {
    message,
    session_id: options?.sessionId || 0,
    language: options?.language || 'en',
    page_context: options?.pageContext || '',
    user_type: userType,
    disabled_tools: options?.disabledTools || [],
  };

  const response = await fetch(`${AI_API_BASE}/chat/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    callbacks.onError(text || `HTTP ${response.status}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      // Hono streamSSE format: "event: xxx" + "data: xxx"
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
        continue;
      }

      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);

      try {
        const parsed = JSON.parse(data);

        // Support both formats:
        // Format A (Hono streamSSE): event line + data line
        // Format B (legacy enjoysa): data with type field
        const eventType = currentEvent || parsed.type;
        currentEvent = '';

        switch (eventType) {
          case 'session':
            if (parsed.session_id) callbacks.onSessionId(parsed.session_id);
            break;
          case 'token':
            if (parsed.content) callbacks.onToken(parsed.content);
            break;
          case 'done':
            callbacks.onDone();
            break;
          case 'tool_call':
            callbacks.onToolCall?.(parsed as ToolCallEvent);
            break;
          case 'tool_result':
            callbacks.onToolResult?.(parsed as ToolResultEvent);
            break;
          case 'error':
            callbacks.onError(parsed.error || parsed.content || 'Unknown error');
            break;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
}

// === After-sales API (via ai-service) ===

/**
 * Classify message intent
 */
export async function classifyIntent(message: string): Promise<IntentResult | null> {
  const token = getAccessToken('user');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${AI_API_BASE}/intent/classify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  });
  if (!response.ok) return null;

  const data = await response.json();
  return data.data || null;
}

/**
 * Create after-sales ticket
 */
export async function createTicket(params: {
  type: string;
  subject: string;
  description?: string;
  orderId?: number;
}): Promise<Ticket | null> {
  const token = getAccessToken('user');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${AI_API_BASE}/crm/tickets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: params.type,
      subject: params.subject,
      description: params.description,
      order_id: params.orderId,
      source: 'web',
    }),
  });
  if (!response.ok) return null;

  const data = await response.json();
  return data.data || null;
}

/**
 * Get ticket by ID
 */
export async function getTicket(ticketId: number): Promise<Ticket | null> {
  const token = getAccessToken('user');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${AI_API_BASE}/crm/tickets/${ticketId}`, { headers });
  if (!response.ok) return null;

  const data = await response.json();
  return data.data?.ticket || null;
}

/**
 * Search orders by email
 */
export async function searchMyOrders(): Promise<unknown[]> {
  const token = getAccessToken('user');
  if (!token) return [];

  // Use the main enjoysa API for user orders
  const response = await fetch(`${API_BASE}/orders`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) return [];

  const data = await response.json();
  return data.data?.items || data.data || [];
}
