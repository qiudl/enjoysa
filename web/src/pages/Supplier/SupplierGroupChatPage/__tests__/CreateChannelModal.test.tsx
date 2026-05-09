import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SupplierGroupChatPage from '../SupplierGroupChatPage';
import { setTokens } from '../../../../services/api';

// REQ-20260509-0037 dev-10: CreateChannelModal end-to-end smoke test
// (rendered inside the real SupplierGroupChatPage so the modal integrates
// with GroupChatProvider + the sidebar's "+" button trigger).

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
      { id: 10, workspace_id: 1, name: '客服-默认', slug: 'kefu-default', description: '', default_agent_id: 1, keyword_rules: [], is_default: true, archived: false, created_at: 't', updated_at: 't', member_agent_ids: [1, 2] },
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

describe('CreateChannelModal — REQ-20260509-0037 dev-10', () => {
  it('opens via the sidebar "+" button and submits a POST to /chat/channels with the form payload', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/chat/v2/workspace')) return jsonResponse(workspaceFixture);
      if (u.includes('/chat/channels/10/messages')) {
        return jsonResponse({ success: true, data: { messages: [], thread_reply_counts: {} } });
      }
      if (u.endsWith('/chat/channels') && init?.method === 'POST') {
        return jsonResponse({
          success: true,
          data: { id: 99, workspace_id: 1, name: 'API-技术', slug: 'api-tech', description: 'API 集成讨论', default_agent_id: 2, keyword_rules: ['api', 'bug'], is_default: false, archived: false, created_at: 't', updated_at: 't' },
        });
      }
      return jsonResponse({ success: false }, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SupplierGroupChatPage />);

    // Wait for bootstrap, then click the "+" button.
    const newBtn = await screen.findByRole('button', { name: /groupChat\.sidebar\.newChannel/ });
    await userEvent.click(newBtn);

    // Modal opens; type a name + description.
    const nameInput = await screen.findByPlaceholderText('groupChat.createChannel.namePlaceholder');
    await userEvent.type(nameInput, 'API-技术');
    const descInput = screen.getByPlaceholderText('groupChat.createChannel.descriptionPlaceholder');
    await userEvent.type(descInput, 'API 集成讨论');

    // Both default agents are pre-selected; flip 技术阿澳 to default by clicking
    // its "Make default" button (the leftmost selected becomes the default).
    const makeDefault = screen.getAllByRole('button', { name: 'groupChat.createChannel.makeDefault' });
    // First "make default" we see is for 技术阿澳 (since 客服小南 is currently default).
    await userEvent.click(makeDefault[0]);

    // Type keyword rules.
    const kw = screen.getByPlaceholderText('groupChat.createChannel.keywordsPlaceholder');
    await userEvent.type(kw, 'api, bug');

    // Submit.
    await userEvent.click(screen.getByRole('button', { name: 'groupChat.createChannel.submit' }));

    // Verify the POST hit /chat/channels with the assembled body.
    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([u, init]) => String(u).endsWith('/chat/channels') && (init as RequestInit | undefined)?.method === 'POST');
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body.name).toBe('API-技术');
      expect(body.description).toBe('API 集成讨论');
      expect(body.keyword_rules).toEqual(['api', 'bug']);
      expect(body.agent_ids[0]).toBe(2); // 技术阿澳 promoted to default
      expect(body.agent_ids).toContain(1);
    });

    // Modal closes after successful create.
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('groupChat.createChannel.namePlaceholder')).not.toBeInTheDocument();
    });
  });

  it('blocks submit when no agents are selected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        if (u.endsWith('/chat/v2/workspace')) return jsonResponse(workspaceFixture);
        if (u.includes('/chat/channels/10/messages')) return jsonResponse({ success: true, data: { messages: [], thread_reply_counts: {} } });
        return jsonResponse({ success: false }, { status: 404 });
      }),
    );

    render(<SupplierGroupChatPage />);
    const newBtn = await screen.findByRole('button', { name: /groupChat\.sidebar\.newChannel/ });
    await userEvent.click(newBtn);

    const nameInput = await screen.findByPlaceholderText('groupChat.createChannel.namePlaceholder');
    await userEvent.type(nameInput, 'X');

    // Uncheck both agents.
    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      if ((cb as HTMLInputElement).checked) {
        await userEvent.click(cb);
      }
    }

    const submit = screen.getByRole('button', { name: 'groupChat.createChannel.submit' });
    expect(submit).toBeDisabled();
  });
});
