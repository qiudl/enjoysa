/**
 * Group Chat Service — REQ-20260509-0037 dev-7.
 *
 * API client for the workspace + channel + thread backend (dev-3..dev-6).
 * Mirrors chatService.ts patterns: same auth header, same SSE parser shape,
 * same default base URL. The legacy chatService stays untouched — group
 * chat lives at a parallel set of endpoints under /api/v1/chat/v2 + /chat/{channels,threads}.
 */

import { getAccessToken, type UserType } from './api';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';
const AI_API_BASE = import.meta.env.VITE_AI_API_BASE || API_BASE;

// =====================================================================
// Types — mirror backend/internal/chat/model + handler view shapes
// =====================================================================

export interface ChatWorkspace {
  id: number;
  owner_user_id: number;
  owner_user_type: string;
  created_at: string;
  updated_at: string;
}

export interface ChatAgent {
  id: number;
  code: string;
  name: string;
  member_type: 'ai' | 'human';
  llm_provider: string;
  llm_model: string;
  system_prompt: string;
  tool_keys: string[];
  avatar_emoji: string;
  color_hex: string;
  sort_order: number;
  default_in_new_channel: boolean;
  enabled: boolean;
}

export interface ChatChannel {
  id: number;
  workspace_id: number;
  name: string;
  slug: string;
  description: string;
  default_agent_id: number | null;
  keyword_rules: string[];
  is_default: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/** ChannelView extends ChatChannel with the agent member ids (server adds it). */
export interface ChatChannelView extends ChatChannel {
  member_agent_ids: number[];
}

export interface ChatChannelMember {
  id: number;
  channel_id: number;
  member_type: 'ai' | 'human';
  agent_id: number | null;
  admin_id: number | null;
  muted: boolean;
  joined_at: string;
}

/**
 * ChatGroupMessage is the dev-2/dev-5 expanded chat_messages row. Legacy
 * fields (session_id/role/content) coexist with the new channel/thread/sender
 * columns; old rows have channel_id=null and group-chat rows have it set.
 */
export interface ChatGroupMessage {
  id: number;
  channel_id: number | null;
  thread_parent_id: number | null;
  sender_type: 'user' | 'ai' | 'human' | 'system' | string;
  sender_agent_id: number | null;
  sender_admin_id: number | null;
  mentions: number[];
  also_in_channel: boolean;
  content: string;
  created_at: string;
  // Legacy fields for back-compat with old rows.
  session_id?: number | null;
  role?: string;
}

export interface WorkspaceBootstrap {
  workspace: ChatWorkspace;
  channels: ChatChannelView[];
  agents: ChatAgent[];
}

export interface ChannelMessagesPage {
  messages: ChatGroupMessage[];
  thread_reply_counts: Record<number, number>;
}

export interface ThreadView {
  parent: ChatGroupMessage;
  replies: ChatGroupMessage[];
}

// =====================================================================
// SSE event shapes — match backend writeSSE payloads in
// backend/internal/chat/handler/group_chat_send.go + group_chat_thread.go
// =====================================================================

export interface GroupChatUserEvent {
  id: number;
  thread_parent_id?: number;
  content: string;
  mentions: number[];
  also_in_channel?: boolean;
  created_at: string;
}

export interface GroupChatRouteEvent {
  agent: {
    id: number;
    code: string;
    name: string;
    avatar_emoji: string;
    color_hex: string;
  };
  reason: string;
  ephemeral_in_thread?: boolean;
  soft_hint?: string;
}

export interface GroupChatToolCallEvent {
  id: string;
  name: string;
  arguments: string;
}

export interface GroupChatToolResultEvent {
  id: string;
  name: string;
  result: string;
  duration_ms: number;
  success: boolean;
}

export interface GroupChatErrorEvent {
  category: string;
  hint: string;
  detail?: string;
  soft_hint?: string;
}

export interface GroupChatStreamCallbacks {
  onUser?: (ev: GroupChatUserEvent) => void;
  onRoute?: (ev: GroupChatRouteEvent) => void;
  onContent: (chunk: string) => void;
  onStatus?: (status: string) => void;
  onToolCall?: (ev: GroupChatToolCallEvent) => void;
  onToolResult?: (ev: GroupChatToolResultEvent) => void;
  onError?: (ev: GroupChatErrorEvent | { category: 'transport'; hint: string; detail?: string }) => void;
  onDone?: () => void;
}

// =====================================================================
// REST endpoints
// =====================================================================

function authHeaders(userType: UserType): Record<string, string> {
  const token = getAccessToken(userType);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = body?.message || body?.error || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return (body?.data ?? body) as T;
}

/** Bootstrap the caller's workspace; idempotently creates default channel. */
export async function getWorkspace(userType: UserType): Promise<WorkspaceBootstrap> {
  const r = await fetch(`${AI_API_BASE}/chat/v2/workspace`, { headers: authHeaders(userType) });
  return unwrap<WorkspaceBootstrap>(r);
}

export interface CreateChannelInput {
  name: string;
  description?: string;
  agent_ids: number[];
  keyword_rules?: string[];
}

export async function createChannel(input: CreateChannelInput, userType: UserType): Promise<ChatChannel> {
  const r = await fetch(`${AI_API_BASE}/chat/channels`, {
    method: 'POST',
    headers: authHeaders(userType),
    body: JSON.stringify(input),
  });
  return unwrap<ChatChannel>(r);
}

export interface UpdateChannelInput {
  name?: string;
  description?: string;
  default_agent_id?: number;
  keyword_rules?: string[];
}

export async function updateChannel(channelID: number, input: UpdateChannelInput, userType: UserType): Promise<ChatChannel> {
  const r = await fetch(`${AI_API_BASE}/chat/channels/${channelID}`, {
    method: 'PATCH',
    headers: authHeaders(userType),
    body: JSON.stringify(input),
  });
  return unwrap<ChatChannel>(r);
}

export async function archiveChannel(channelID: number, userType: UserType): Promise<void> {
  const r = await fetch(`${AI_API_BASE}/chat/channels/${channelID}/archive`, {
    method: 'POST',
    headers: authHeaders(userType),
  });
  await unwrap<unknown>(r);
}

export async function setMemberMute(channelID: number, agentID: number, muted: boolean, userType: UserType): Promise<void> {
  const r = await fetch(`${AI_API_BASE}/chat/channels/${channelID}/members/${agentID}`, {
    method: 'PATCH',
    headers: authHeaders(userType),
    body: JSON.stringify({ muted }),
  });
  await unwrap<unknown>(r);
}

export async function getChannelMessages(
  channelID: number,
  opts: { before?: number; limit?: number } | undefined,
  userType: UserType,
): Promise<ChannelMessagesPage> {
  const qs = new URLSearchParams();
  if (opts?.before) qs.set('before', String(opts.before));
  if (opts?.limit) qs.set('limit', String(opts.limit));
  const url = `${AI_API_BASE}/chat/channels/${channelID}/messages${qs.toString() ? '?' + qs : ''}`;
  const r = await fetch(url, { headers: authHeaders(userType) });
  return unwrap<ChannelMessagesPage>(r);
}

export async function getThreadReplies(parentID: number, limit: number | undefined, userType: UserType): Promise<ThreadView> {
  const qs = limit ? `?limit=${limit}` : '';
  const r = await fetch(`${AI_API_BASE}/chat/threads/${parentID}/messages${qs}`, { headers: authHeaders(userType) });
  return unwrap<ThreadView>(r);
}

// =====================================================================
// SSE — channel send + thread send share the same parser
// =====================================================================

export interface SendChannelMessageInput {
  content: string;
  mentions?: number[];
  image_urls?: string[];
}

export interface SendThreadMessageInput extends SendChannelMessageInput {
  also_in_channel?: boolean;
}

export async function sendChannelMessageStream(
  channelID: number,
  input: SendChannelMessageInput,
  callbacks: GroupChatStreamCallbacks,
  userType: UserType,
  signal?: AbortSignal,
): Promise<void> {
  return streamGroupChatSSE(`${AI_API_BASE}/chat/channels/${channelID}/messages`, input, callbacks, userType, signal);
}

export async function sendThreadMessageStream(
  parentID: number,
  input: SendThreadMessageInput,
  callbacks: GroupChatStreamCallbacks,
  userType: UserType,
  signal?: AbortSignal,
): Promise<void> {
  return streamGroupChatSSE(`${AI_API_BASE}/chat/threads/${parentID}/messages`, input, callbacks, userType, signal);
}

/**
 * Internal: POST + parse SSE for both channel and thread send. Backend frames
 * are JSON objects with a `type` field (writeSSE payload format). Mirrors the
 * legacy chatService.sendMessageStream parser, with the new event vocabulary.
 */
async function streamGroupChatSSE(
  url: string,
  body: object,
  callbacks: GroupChatStreamCallbacks,
  userType: UserType,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(userType),
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    callbacks.onError?.({ category: 'transport', hint: 'network error', detail: (err as Error).message });
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    callbacks.onError?.({ category: 'transport', hint: `HTTP ${response.status}`, detail: text });
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.({ category: 'transport', hint: 'no response body' });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (err) {
      callbacks.onError?.({ category: 'transport', hint: 'stream read failed', detail: (err as Error).message });
      return;
    }
    if (chunk.done) break;

    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (!payload) continue;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      dispatchGroupChatEvent(parsed, callbacks);
    }
  }

  // Some servers omit the trailing newline; flush any final buffered frame.
  const tail = buffer.trim();
  if (tail.startsWith('data: ')) {
    try {
      dispatchGroupChatEvent(JSON.parse(tail.slice(6)), callbacks);
    } catch {
      /* ignore */
    }
  }
}

/** Exported for unit tests — pure function, no I/O. */
export function dispatchGroupChatEvent(payload: Record<string, unknown>, callbacks: GroupChatStreamCallbacks): void {
  const type = payload.type as string | undefined;
  if (!type) return;
  switch (type) {
    case 'user':
      callbacks.onUser?.(payload as unknown as GroupChatUserEvent);
      break;
    case 'route':
      callbacks.onRoute?.(payload as unknown as GroupChatRouteEvent);
      break;
    case 'content': {
      const content = payload.content;
      if (typeof content === 'string' && content.length > 0) callbacks.onContent(content);
      break;
    }
    case 'status':
      callbacks.onStatus?.(typeof payload.content === 'string' ? payload.content : '');
      break;
    case 'tool_call':
      callbacks.onToolCall?.(payload as unknown as GroupChatToolCallEvent);
      break;
    case 'tool_result':
      callbacks.onToolResult?.(payload as unknown as GroupChatToolResultEvent);
      break;
    case 'error':
      callbacks.onError?.(payload as unknown as GroupChatErrorEvent);
      break;
    case 'done':
      callbacks.onDone?.();
      break;
    default:
      // Unknown event types are ignored — forward-compat with future
      // backend additions (e.g. typing indicator) without breaking the
      // current client.
      break;
  }
}
