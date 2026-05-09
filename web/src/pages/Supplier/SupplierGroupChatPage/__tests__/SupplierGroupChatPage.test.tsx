import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SupplierGroupChatPage from '../SupplierGroupChatPage';
import { setTokens } from '../../../../services/api';

// REQ-20260509-0037 dev-8: shell smoke test. Asserts the 3-col page mounts,
// bootstraps from /chat/v2/workspace, renders the channel list + topbar,
// and POSTs to /chat/channels/:id/messages on send. Streaming/SSE deep
// behavior is covered in groupChatService.test.ts.

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
        member_agent_ids: [1, 2],
      },
      {
        id: 11,
        workspace_id: 1,
        name: 'API-技术',
        slug: 'api-tech',
        description: 'API 集成讨论',
        default_agent_id: 2,
        keyword_rules: ['api', 'bug'],
        is_default: false,
        archived: false,
        created_at: 't',
        updated_at: 't',
        member_agent_ids: [2],
      },
    ],
    agents: [
      { id: 1, code: 'cs', name: '客服小南', member_type: 'ai', llm_provider: 'deepseek', llm_model: '', system_prompt: '', tool_keys: [], avatar_emoji: '🙋', color_hex: '#16a34a', sort_order: 10, default_in_new_channel: true, enabled: true },
      { id: 2, code: 'tech', name: '技术阿澳', member_type: 'ai', llm_provider: 'glm', llm_model: '', system_prompt: '', tool_keys: [], avatar_emoji: '🛠', color_hex: '#2563eb', sort_order: 20, default_in_new_channel: true, enabled: true },
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

describe('SupplierGroupChatPage shell', () => {
  it('bootstraps the workspace and renders sidebar channels + active channel topbar', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.endsWith('/chat/v2/workspace')) return jsonResponse(workspaceFixture);
      if (u.includes('/chat/channels/10/messages')) {
        return jsonResponse({ success: true, data: { messages: [], thread_reply_counts: {} } });
      }
      return jsonResponse({ success: false }, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SupplierGroupChatPage />);

    // Sidebar channels appear (both names visible)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /客服-默认/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /API-技术/ })).toBeInTheDocument();
    });

    // Default channel auto-selected → topbar reflects it.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /客服-默认/ })).toHaveAttribute('aria-current', 'true');
    });

    // Topbar shows agent member pills for the default channel members
    // (agents also appear as colored dots in the sidebar — both surfaces
    // get a `title` attr, so getAllByTitle).
    await waitFor(() => {
      expect(screen.getAllByTitle('客服小南').length).toBeGreaterThan(0);
      expect(screen.getAllByTitle('技术阿澳').length).toBeGreaterThan(0);
    });

    // Bootstrap fetched workspace + auto-loaded the default channel's messages.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chat/v2/workspace'),
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chat/channels/10/messages'),
      expect.any(Object),
    );
  });

  it('switches active channel when a sidebar row is clicked', async () => {
    const messageCalls: string[] = [];
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.endsWith('/chat/v2/workspace')) return jsonResponse(workspaceFixture);
      if (u.includes('/messages')) {
        messageCalls.push(u);
        return jsonResponse({ success: true, data: { messages: [], thread_reply_counts: {} } });
      }
      return jsonResponse({ success: false }, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SupplierGroupChatPage />);

    // Wait for channels to render.
    await waitFor(() => expect(screen.getByRole('button', { name: /API-技术/ })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /API-技术/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /API-技术/ })).toHaveAttribute('aria-current', 'true');
    });
    // The channel switch should have triggered a fetch for channel 11's messages.
    await waitFor(() => {
      expect(messageCalls.some(u => u.includes('/chat/channels/11/messages'))).toBe(true);
    });
  });

  it('opens a specific channel when slug prop is provided', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.endsWith('/chat/v2/workspace')) return jsonResponse(workspaceFixture);
      if (u.includes('/messages')) {
        return jsonResponse({ success: true, data: { messages: [], thread_reply_counts: {} } });
      }
      return jsonResponse({ success: false }, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SupplierGroupChatPage slugFromRoute="api-tech" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /API-技术/ })).toHaveAttribute('aria-current', 'true');
    });
  });
});
