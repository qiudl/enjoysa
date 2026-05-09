import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SupplierGroupChatPage from '../SupplierGroupChatPage';
import { setTokens } from '../../../../services/api';

// REQ-20260509-0037 dev-9: ThreadPanel + hover action smoke tests.

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

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const workspaceFixture = {
  success: true,
  data: {
    workspace: { id: 1, owner_user_id: 9, owner_user_type: 'supplier', created_at: 't', updated_at: 't' },
    channels: [
      {
        id: 10,
        workspace_id: 1,
        name: '客服-默认',
        slug: 'kefu-default',
        description: '默认客服频道',
        default_agent_id: 1,
        keyword_rules: [],
        is_default: true,
        archived: false,
        created_at: 't',
        updated_at: 't',
        member_agent_ids: [1],
      },
    ],
    agents: [
      { id: 1, code: 'cs', name: '客服小南', member_type: 'ai', llm_provider: 'deepseek', llm_model: '', system_prompt: '', tool_keys: [], avatar_emoji: '🙋', color_hex: '#16a34a', sort_order: 10, default_in_new_channel: true, enabled: true },
    ],
  },
};

const channelMessages = {
  success: true,
  data: {
    messages: [
      {
        id: 100,
        channel_id: 10,
        thread_parent_id: null,
        sender_type: 'user',
        sender_agent_id: null,
        sender_admin_id: null,
        mentions: [],
        also_in_channel: false,
        content: '退款这单怎么处理？',
        created_at: '2026-05-10T00:00:00Z',
      },
      {
        id: 101,
        channel_id: 10,
        thread_parent_id: null,
        sender_type: 'ai',
        sender_agent_id: 1,
        sender_admin_id: null,
        mentions: [],
        also_in_channel: false,
        content: '我帮你查一下订单。',
        created_at: '2026-05-10T00:00:01Z',
      },
    ],
    thread_reply_counts: { 100: 3 }, // message 100 already has 3 replies
  },
};

const threadView = {
  success: true,
  data: {
    parent: channelMessages.data.messages[0],
    replies: [
      {
        id: 200,
        channel_id: 10,
        thread_parent_id: 100,
        sender_type: 'ai',
        sender_agent_id: 1,
        sender_admin_id: null,
        mentions: [],
        also_in_channel: false,
        content: '已查到该订单，状态是 paid。',
        created_at: '2026-05-10T00:01:00Z',
      },
    ],
  },
};

beforeEach(() => {
  installLocalStorage();
  setTokens('supplier', 'tok-access', 'tok-refresh');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function makeFetchMock(threadCallTracker?: { count: number }) {
  return vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.endsWith('/chat/v2/workspace')) return jsonResponse(workspaceFixture);
    if (u.includes('/chat/channels/10/messages')) return jsonResponse(channelMessages);
    if (u.includes('/chat/threads/100/messages')) {
      if (threadCallTracker) threadCallTracker.count += 1;
      return jsonResponse(threadView);
    }
    return jsonResponse({ success: false }, { status: 404 });
  });
}

describe('ThreadPanel — REQ-20260509-0037 dev-9', () => {
  it('renders the reply count badge for messages with existing thread replies', async () => {
    vi.stubGlobal('fetch', makeFetchMock());
    render(<SupplierGroupChatPage />);

    // The first message has 3 replies per the fixture.
    const badge = await screen.findByRole('button', { name: /groupChat\.thread\.replyCount/ });
    expect(badge).toBeInTheDocument();
  });

  it('opens the thread panel when the reply badge is clicked + loads thread replies', async () => {
    const tracker = { count: 0 };
    vi.stubGlobal('fetch', makeFetchMock(tracker));
    render(<SupplierGroupChatPage />);

    const badge = await screen.findByRole('button', { name: /groupChat\.thread\.replyCount/ });
    await userEvent.click(badge);

    // Thread panel renders with its title.
    await waitFor(() => expect(screen.getByText('groupChat.thread.title')).toBeInTheDocument());

    // Replies fetched + reply content visible.
    await waitFor(() => {
      expect(tracker.count).toBeGreaterThan(0);
      expect(screen.getByText('已查到该订单，状态是 paid。')).toBeInTheDocument();
    });
  });

  it('closes the thread when the close button is clicked', async () => {
    vi.stubGlobal('fetch', makeFetchMock());
    render(<SupplierGroupChatPage />);

    const badge = await screen.findByRole('button', { name: /groupChat\.thread\.replyCount/ });
    await userEvent.click(badge);

    await waitFor(() => expect(screen.getByText('groupChat.thread.title')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'groupChat.thread.close' }));

    await waitFor(() => expect(screen.queryByText('groupChat.thread.title')).not.toBeInTheDocument());
  });
});
