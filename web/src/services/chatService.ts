/**
 * Chat Service — AI Chat API + SSE streaming client
 */

import { getAccessToken, type UserType } from './api';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

export interface ChatMessage {
  id?: number;
  session_id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export interface ChatSession {
  id: number;
  title: string;
  language: string;
  created_at: string;
  updated_at: string;
}

interface SSEEvent {
  type: 'session' | 'token' | 'done' | 'error';
  session_id?: number;
  content?: string;
}

export interface StreamCallbacks {
  onSessionId: (sessionId: number) => void;
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
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
  };

  const response = await fetch(`${API_BASE}/chat/send`, {
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);

      try {
        const event: SSEEvent = JSON.parse(data);
        switch (event.type) {
          case 'session':
            if (event.session_id) callbacks.onSessionId(event.session_id);
            break;
          case 'token':
            if (event.content) callbacks.onToken(event.content);
            break;
          case 'done':
            callbacks.onDone();
            break;
          case 'error':
            callbacks.onError(event.content || 'Unknown error');
            break;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
}
