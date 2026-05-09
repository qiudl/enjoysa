import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  archiveChannel,
  createChannel,
  dispatchGroupChatEvent,
  getChannelMessages,
  getThreadReplies,
  getWorkspace,
  sendChannelMessageStream,
  type GroupChatStreamCallbacks,
} from '../groupChatService';
import { setTokens } from '../api';

// REQ-20260509-0037 dev-7: contract tests for the group-chat service. Pinned
// against the backend writeSSE shapes in
// backend/internal/chat/handler/group_chat_send.go + group_chat_thread.go.

// Map-backed localStorage shim so api.setTokens works under jsdom (the
// jsdom localStorage occasionally surfaces as a non-writable getter on the
// vitest worker recycle path — same reason api.test.ts ships its own).
function installLocalStorage() {
  const store = new Map<string, string>();
  const fake: Storage = {
    get length() { return store.size; },
    clear() { store.clear(); },
    getItem(k) { return store.has(k) ? (store.get(k) as string) : null; },
    key(i) { return Array.from(store.keys())[i] ?? null; },
    removeItem(k) { store.delete(k); },
    setItem(k, v) { store.set(k, String(v)); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
}

beforeEach(() => {
  installLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function withSupplierToken() {
  setTokens('supplier', 'tok-access', 'tok-refresh');
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('dispatchGroupChatEvent', () => {
  function harness() {
    const calls: Record<string, unknown[]> = {
      user: [],
      route: [],
      content: [],
      status: [],
      tool_call: [],
      tool_result: [],
      error: [],
      done: [],
    };
    const cb: GroupChatStreamCallbacks = {
      onUser: ev => { calls.user.push(ev); },
      onRoute: ev => { calls.route.push(ev); },
      onContent: c => { calls.content.push(c); },
      onStatus: s => { calls.status.push(s); },
      onToolCall: ev => { calls.tool_call.push(ev); },
      onToolResult: ev => { calls.tool_result.push(ev); },
      onError: ev => { calls.error.push(ev); },
      onDone: () => { calls.done.push(true); },
    };
    return { cb, calls };
  }

  it('routes each event type to the matching callback', () => {
    const { cb, calls } = harness();
    dispatchGroupChatEvent({ type: 'user', id: 1, content: 'hi', mentions: [], created_at: 't' }, cb);
    dispatchGroupChatEvent({ type: 'route', agent: { id: 7, code: 'cs', name: 'CS', avatar_emoji: '🙋', color_hex: '#0f0' }, reason: 'channel_default' }, cb);
    dispatchGroupChatEvent({ type: 'content', content: 'hello' }, cb);
    dispatchGroupChatEvent({ type: 'content', content: ' world' }, cb);
    dispatchGroupChatEvent({ type: 'status', content: '识别图片中' }, cb);
    dispatchGroupChatEvent({ type: 'tool_call', id: 'tc1', name: 'search_orders', arguments: '{}' }, cb);
    dispatchGroupChatEvent({ type: 'tool_result', id: 'tc1', name: 'search_orders', result: '[]', duration_ms: 12, success: true }, cb);
    dispatchGroupChatEvent({ type: 'error', category: 'llm_stream_error', hint: 'LLM 调用失败', detail: 'boom' }, cb);
    dispatchGroupChatEvent({ type: 'done' }, cb);

    expect(calls.user).toHaveLength(1);
    expect(calls.route).toHaveLength(1);
    expect(calls.content).toEqual(['hello', ' world']);
    expect(calls.status).toEqual(['识别图片中']);
    expect(calls.tool_call).toHaveLength(1);
    expect(calls.tool_result).toHaveLength(1);
    expect(calls.error).toHaveLength(1);
    expect(calls.done).toEqual([true]);
  });

  it('drops empty content frames so consumers do not see "" tokens', () => {
    const { cb, calls } = harness();
    dispatchGroupChatEvent({ type: 'content', content: '' }, cb);
    dispatchGroupChatEvent({ type: 'content' }, cb);
    expect(calls.content).toEqual([]);
  });

  it('ignores events without a type and unknown event types', () => {
    const { cb, calls } = harness();
    dispatchGroupChatEvent({ content: 'no type' }, cb);
    dispatchGroupChatEvent({ type: 'typing_indicator', who: 'agent#7' }, cb); // forward-compat
    expect(calls.content).toEqual([]);
    expect(calls.user).toEqual([]);
    // No throw, no error callback.
    expect(calls.error).toEqual([]);
  });
});

describe('REST endpoints unwrap response.data correctly', () => {
  it('getWorkspace returns the data envelope', async () => {
    withSupplierToken();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          success: true,
          data: {
            workspace: { id: 1, owner_user_id: 9, owner_user_type: 'supplier', created_at: 't', updated_at: 't' },
            channels: [],
            agents: [],
          },
        }),
      ),
    );
    const got = await getWorkspace('supplier');
    expect(got.workspace.id).toBe(1);
    expect(got.channels).toEqual([]);
  });

  it('createChannel POSTs the input and returns the row', async () => {
    withSupplierToken();
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: { id: 42, workspace_id: 1, name: 'API-tech', slug: 'api-tech', description: '', default_agent_id: 7, keyword_rules: [], is_default: false, archived: false, created_at: 't', updated_at: 't' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const ch = await createChannel({ name: 'API-tech', agent_ids: [7] }, 'supplier');
    expect(ch.id).toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ name: 'API-tech', agent_ids: [7] });
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-access');
  });

  it('archiveChannel surfaces server error message', async () => {
    withSupplierToken();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ success: false, message: 'default channel cannot be archived' }, { status: 400 })),
    );
    await expect(archiveChannel(1, 'supplier')).rejects.toThrow('default channel cannot be archived');
  });

  it('getChannelMessages forwards before+limit query params', async () => {
    withSupplierToken();
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: { messages: [], thread_reply_counts: {} } }));
    vi.stubGlobal('fetch', fetchMock);

    await getChannelMessages(7, { before: 100, limit: 25 }, 'supplier');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/chat/channels/7/messages');
    expect(url).toContain('before=100');
    expect(url).toContain('limit=25');
  });

  it('getThreadReplies returns parent + replies', async () => {
    withSupplierToken();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          success: true,
          data: {
            parent: { id: 5, content: 'topic', sender_type: 'user', created_at: 't', mentions: [], also_in_channel: false, channel_id: 1, thread_parent_id: null, sender_agent_id: null, sender_admin_id: null },
            replies: [],
          },
        }),
      ),
    );
    const view = await getThreadReplies(5, 50, 'supplier');
    expect(view.parent.id).toBe(5);
  });
});

describe('sendChannelMessageStream parses an SSE flight end-to-end', () => {
  it('walks a happy-path stream: user → route → content × N → done', async () => {
    withSupplierToken();

    // Build an SSE body with realistic frames ending in "\n\n" pairs.
    const frames = [
      JSON.stringify({ type: 'user', id: 100, content: 'hi', mentions: [], created_at: '2026-05-10T00:00:00Z' }),
      JSON.stringify({ type: 'route', agent: { id: 7, code: 'cs', name: 'CS', avatar_emoji: '🙋', color_hex: '#0f0' }, reason: 'channel_default' }),
      JSON.stringify({ type: 'content', content: 'Hello' }),
      JSON.stringify({ type: 'content', content: ' World' }),
      JSON.stringify({ type: 'done' }),
    ];
    const body = frames.map(f => `data: ${f}\n\n`).join('');
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode(body));
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      ),
    );

    const events: string[] = [];
    let assembled = '';
    let userId = 0;
    let routeAgentId = 0;
    await sendChannelMessageStream(
      9,
      { content: 'hi' },
      {
        onUser: ev => { events.push('user'); userId = ev.id; },
        onRoute: ev => { events.push('route'); routeAgentId = ev.agent.id; },
        onContent: c => { events.push('content'); assembled += c; },
        onDone: () => { events.push('done'); },
        onError: () => { events.push('error'); },
      },
      'supplier',
    );

    expect(events).toEqual(['user', 'route', 'content', 'content', 'done']);
    expect(userId).toBe(100);
    expect(routeAgentId).toBe(7);
    expect(assembled).toBe('Hello World');
  });

  it('reports transport error when fetch rejects', async () => {
    withSupplierToken();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('econn refused'); }));

    let category = '';
    await sendChannelMessageStream(
      1,
      { content: 'hi' },
      {
        onContent: () => {},
        onError: ev => { category = ev.category; },
      },
      'supplier',
    );
    expect(category).toBe('transport');
  });

  it('surfaces server-side error event without throwing', async () => {
    withSupplierToken();
    const frames = [
      JSON.stringify({ type: 'error', category: 'no_responder', hint: '频道里没有可应答的 agent' }),
      JSON.stringify({ type: 'done' }),
    ];
    const body = frames.map(f => `data: ${f}\n\n`).join('');
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode(body));
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })),
    );

    const errors: string[] = [];
    await sendChannelMessageStream(
      1,
      { content: 'hi' },
      { onContent: () => {}, onError: ev => { errors.push((ev as { category: string }).category); }, onDone: () => {} },
      'supplier',
    );
    expect(errors).toEqual(['no_responder']);
  });
});
