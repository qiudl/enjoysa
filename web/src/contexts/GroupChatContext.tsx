/**
 * GroupChatContext — REQ-20260509-0037 dev-7.
 *
 * Frontend state for the workspace + channel + thread UI. Owns:
 *   - workspace bootstrap (from GET /chat/v2/workspace)
 *   - channel + agent registries
 *   - active selection (channel id + thread parent id)
 *   - per-channel main flow message cache + per-thread reply cache
 *   - in-flight stream metadata (which agent is replying, status text, last error)
 *
 * Does NOT render anything — UI components plug in via useGroupChat().
 *
 * The legacy ChatContext / SupplierAIChatPage stay untouched. The 3-column UI
 * (dev-8+) will replace SupplierAIChatPage.tsx and consume this context.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { UserType } from '../services/api';
import {
  archiveChannel as apiArchiveChannel,
  createChannel as apiCreateChannel,
  getChannelMessages,
  getThreadReplies,
  getWorkspace,
  sendChannelMessageStream,
  sendThreadMessageStream,
  setMemberMute as apiSetMemberMute,
  updateChannel as apiUpdateChannel,
  type ChatAgent,
  type ChatChannel,
  type ChatChannelView,
  type ChatGroupMessage,
  type ChatWorkspace,
  type CreateChannelInput,
  type GroupChatErrorEvent,
  type SendChannelMessageInput,
  type SendThreadMessageInput,
  type UpdateChannelInput,
} from '../services/groupChatService';

interface StreamingState {
  channelId: number | null;
  threadParentId: number | null;
  routeAgentId: number | null;
  status: string;
  assembledContent: string;
}

const initialStreaming: StreamingState = {
  channelId: null,
  threadParentId: null,
  routeAgentId: null,
  status: '',
  assembledContent: '',
};

export interface GroupChatState {
  userType: UserType;
  workspace: ChatWorkspace | null;
  channels: ChatChannelView[];
  agents: ChatAgent[];
  activeChannelId: number | null;
  activeThreadParentId: number | null;
  messagesByChannel: Record<number, ChatGroupMessage[]>;
  threadsByParent: Record<number, ChatGroupMessage[]>;
  threadParents: Record<number, ChatGroupMessage>;
  threadReplyCounts: Record<number, number>;
  streaming: StreamingState;
  isBootstrapping: boolean;
  isLoadingChannel: Record<number, boolean>;
  isLoadingThread: Record<number, boolean>;
  lastError: string | null;
}

export interface GroupChatActions {
  bootstrap: () => Promise<void>;
  selectChannel: (channelId: number) => Promise<void>;
  openThread: (parent: ChatGroupMessage) => Promise<void>;
  closeThread: () => void;
  loadChannelMessages: (channelId: number, before?: number) => Promise<void>;
  loadThreadReplies: (parentId: number) => Promise<void>;
  sendToChannel: (channelId: number, input: SendChannelMessageInput) => Promise<void>;
  sendToThread: (parentId: number, input: SendThreadMessageInput) => Promise<void>;
  createChannel: (input: CreateChannelInput) => Promise<ChatChannel>;
  updateChannel: (channelId: number, input: UpdateChannelInput) => Promise<void>;
  archiveChannel: (channelId: number) => Promise<void>;
  setMemberMute: (channelId: number, agentId: number, muted: boolean) => Promise<void>;
  clearError: () => void;
}

export type GroupChatContextValue = GroupChatState & GroupChatActions;

const GroupChatContext = createContext<GroupChatContextValue | null>(null);

interface GroupChatProviderProps {
  userType: UserType;
  children: ReactNode;
}

export function GroupChatProvider({ userType, children }: GroupChatProviderProps) {
  const [workspace, setWorkspace] = useState<ChatWorkspace | null>(null);
  const [channels, setChannels] = useState<ChatChannelView[]>([]);
  const [agents, setAgents] = useState<ChatAgent[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [activeThreadParentId, setActiveThreadParentId] = useState<number | null>(null);
  const [messagesByChannel, setMessagesByChannel] = useState<Record<number, ChatGroupMessage[]>>({});
  const [threadsByParent, setThreadsByParent] = useState<Record<number, ChatGroupMessage[]>>({});
  const [threadParents, setThreadParents] = useState<Record<number, ChatGroupMessage>>({});
  const [threadReplyCounts, setThreadReplyCounts] = useState<Record<number, number>>({});
  const [streaming, setStreaming] = useState<StreamingState>(initialStreaming);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isLoadingChannel, setIsLoadingChannel] = useState<Record<number, boolean>>({});
  const [isLoadingThread, setIsLoadingThread] = useState<Record<number, boolean>>({});
  const [lastError, setLastError] = useState<string | null>(null);

  // streamingRef mirrors `streaming` so SSE callbacks can read the latest
  // assembled content without going through a state batch — React batches
  // setState across SSE events and the assembled content gets clobbered if
  // we read from `streaming` directly inside the closures.
  const streamingRef = useRef<StreamingState>(initialStreaming);

  const setStreamingBoth = useCallback((next: StreamingState) => {
    streamingRef.current = next;
    setStreaming(next);
  }, []);

  const loadChannelMessages = useCallback(async (channelId: number, before?: number) => {
    setIsLoadingChannel(prev => ({ ...prev, [channelId]: true }));
    try {
      const page = await getChannelMessages(channelId, before ? { before } : undefined, userType);
      setMessagesByChannel(prev => {
        // For pagination, prepend (older messages); first load replaces.
        const existing = prev[channelId] ?? [];
        const merged = before ? [...page.messages, ...existing] : page.messages;
        return { ...prev, [channelId]: dedupeMessagesById(merged) };
      });
      setThreadReplyCounts(prev => ({ ...prev, ...page.thread_reply_counts }));
    } catch (err) {
      setLastError((err as Error).message);
    } finally {
      setIsLoadingChannel(prev => ({ ...prev, [channelId]: false }));
    }
  }, [userType]);

  const selectChannel = useCallback(async (channelId: number) => {
    setActiveChannelId(channelId);
    setActiveThreadParentId(null);
    if (!messagesByChannel[channelId]) {
      await loadChannelMessages(channelId);
    }
  }, [messagesByChannel, loadChannelMessages]);

  const bootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    setLastError(null);
    try {
      const ws = await getWorkspace(userType);
      setWorkspace(ws.workspace);
      setChannels(ws.channels);
      setAgents(ws.agents);
      // Auto-select the default channel + eagerly load its messages so the
      // user lands on a populated pane, not an empty one.
      const def = ws.channels.find(c => c.is_default) ?? ws.channels[0];
      if (def && activeChannelId === null) {
        setActiveChannelId(def.id);
        // Fire-and-forget — bootstrap shouldn't block on the message fetch.
        void loadChannelMessages(def.id);
      }
    } catch (err) {
      setLastError((err as Error).message);
    } finally {
      setIsBootstrapping(false);
    }
  }, [userType, activeChannelId, loadChannelMessages]);

  const loadThreadReplies = useCallback(async (parentId: number) => {
    setIsLoadingThread(prev => ({ ...prev, [parentId]: true }));
    try {
      const view = await getThreadReplies(parentId, 100, userType);
      setThreadParents(prev => ({ ...prev, [parentId]: view.parent }));
      setThreadsByParent(prev => ({ ...prev, [parentId]: view.replies }));
    } catch (err) {
      setLastError((err as Error).message);
    } finally {
      setIsLoadingThread(prev => ({ ...prev, [parentId]: false }));
    }
  }, [userType]);

  const openThread = useCallback(async (parent: ChatGroupMessage) => {
    setActiveThreadParentId(parent.id);
    setThreadParents(prev => ({ ...prev, [parent.id]: parent }));
    if (!threadsByParent[parent.id]) {
      await loadThreadReplies(parent.id);
    }
  }, [threadsByParent, loadThreadReplies]);

  const closeThread = useCallback(() => {
    setActiveThreadParentId(null);
  }, []);

  // ----- send -----

  const sendToChannel = useCallback(async (channelId: number, input: SendChannelMessageInput) => {
    setStreamingBoth({ ...initialStreaming, channelId });
    await sendChannelMessageStream(
      channelId,
      input,
      {
        onUser: ev => {
          const msg: ChatGroupMessage = {
            id: ev.id,
            channel_id: channelId,
            thread_parent_id: null,
            sender_type: 'user',
            sender_agent_id: null,
            sender_admin_id: null,
            mentions: ev.mentions ?? [],
            also_in_channel: false,
            content: ev.content,
            created_at: ev.created_at,
          };
          setMessagesByChannel(prev => appendMessage(prev, channelId, msg));
        },
        onRoute: ev => {
          setStreamingBoth({ ...streamingRef.current, routeAgentId: ev.agent.id });
        },
        onContent: chunk => {
          const next = { ...streamingRef.current, assembledContent: streamingRef.current.assembledContent + chunk };
          setStreamingBoth(next);
        },
        onStatus: status => {
          setStreamingBoth({ ...streamingRef.current, status });
        },
        onError: ev => {
          setLastError(formatStreamError(ev));
        },
        onDone: () => {
          const final = streamingRef.current;
          if (final.assembledContent) {
            const placeholder: ChatGroupMessage = {
              // Backend persists the message with its real ID; we use a
              // negative timestamp-based stub so optimistic display works
              // until the next channel reload reconciles it.
              id: -Date.now(),
              channel_id: channelId,
              thread_parent_id: null,
              sender_type: 'ai',
              sender_agent_id: final.routeAgentId,
              sender_admin_id: null,
              mentions: [],
              also_in_channel: false,
              content: final.assembledContent,
              created_at: new Date().toISOString(),
            };
            setMessagesByChannel(prev => appendMessage(prev, channelId, placeholder));
          }
          setStreamingBoth(initialStreaming);
        },
      },
      userType,
    );
  }, [userType, setStreamingBoth]);

  const sendToThread = useCallback(async (parentId: number, input: SendThreadMessageInput) => {
    setStreamingBoth({ ...initialStreaming, threadParentId: parentId });
    await sendThreadMessageStream(
      parentId,
      input,
      {
        onUser: ev => {
          const channelId = threadParents[parentId]?.channel_id ?? null;
          const msg: ChatGroupMessage = {
            id: ev.id,
            channel_id: channelId,
            thread_parent_id: parentId,
            sender_type: 'user',
            sender_agent_id: null,
            sender_admin_id: null,
            mentions: ev.mentions ?? [],
            also_in_channel: !!ev.also_in_channel,
            content: ev.content,
            created_at: ev.created_at,
          };
          setThreadsByParent(prev => appendMessage(prev, parentId, msg));
          setThreadReplyCounts(prev => ({ ...prev, [parentId]: (prev[parentId] ?? 0) + 1 }));
          // also_in_channel surfaces in main flow too; reload main flow on done.
        },
        onRoute: ev => {
          setStreamingBoth({ ...streamingRef.current, routeAgentId: ev.agent.id });
        },
        onContent: chunk => {
          const next = { ...streamingRef.current, assembledContent: streamingRef.current.assembledContent + chunk };
          setStreamingBoth(next);
        },
        onStatus: status => {
          setStreamingBoth({ ...streamingRef.current, status });
        },
        onError: ev => {
          setLastError(formatStreamError(ev));
        },
        onDone: () => {
          const final = streamingRef.current;
          const channelId = threadParents[parentId]?.channel_id ?? null;
          if (final.assembledContent) {
            const placeholder: ChatGroupMessage = {
              id: -Date.now(),
              channel_id: channelId,
              thread_parent_id: parentId,
              sender_type: 'ai',
              sender_agent_id: final.routeAgentId,
              sender_admin_id: null,
              mentions: [],
              also_in_channel: false,
              content: final.assembledContent,
              created_at: new Date().toISOString(),
            };
            setThreadsByParent(prev => appendMessage(prev, parentId, placeholder));
            setThreadReplyCounts(prev => ({ ...prev, [parentId]: (prev[parentId] ?? 0) + 1 }));
          }
          setStreamingBoth(initialStreaming);
        },
      },
      userType,
    );
  }, [userType, threadParents, setStreamingBoth]);

  // ----- channel CRUD -----

  const createChannel = useCallback(async (input: CreateChannelInput) => {
    const ch = await apiCreateChannel(input, userType);
    // Refresh the workspace view so member_agent_ids comes back populated.
    await bootstrap();
    return ch;
  }, [userType, bootstrap]);

  const updateChannel = useCallback(async (channelId: number, input: UpdateChannelInput) => {
    await apiUpdateChannel(channelId, input, userType);
    await bootstrap();
  }, [userType, bootstrap]);

  const archiveChannel = useCallback(async (channelId: number) => {
    await apiArchiveChannel(channelId, userType);
    setChannels(prev => prev.filter(c => c.id !== channelId));
    if (activeChannelId === channelId) {
      const fallback = channels.find(c => c.id !== channelId)?.id ?? null;
      setActiveChannelId(fallback);
    }
  }, [userType, activeChannelId, channels]);

  const setMemberMute = useCallback(async (channelId: number, agentId: number, muted: boolean) => {
    await apiSetMemberMute(channelId, agentId, muted, userType);
    // Mute state isn't surfaced in workspaceView yet; consumers should refetch
    // their own member list view when needed.
  }, [userType]);

  const clearError = useCallback(() => setLastError(null), []);

  const value = useMemo<GroupChatContextValue>(() => ({
    userType,
    workspace,
    channels,
    agents,
    activeChannelId,
    activeThreadParentId,
    messagesByChannel,
    threadsByParent,
    threadParents,
    threadReplyCounts,
    streaming,
    isBootstrapping,
    isLoadingChannel,
    isLoadingThread,
    lastError,
    bootstrap,
    selectChannel,
    openThread,
    closeThread,
    loadChannelMessages,
    loadThreadReplies,
    sendToChannel,
    sendToThread,
    createChannel,
    updateChannel,
    archiveChannel,
    setMemberMute,
    clearError,
  }), [
    userType,
    workspace,
    channels,
    agents,
    activeChannelId,
    activeThreadParentId,
    messagesByChannel,
    threadsByParent,
    threadParents,
    threadReplyCounts,
    streaming,
    isBootstrapping,
    isLoadingChannel,
    isLoadingThread,
    lastError,
    bootstrap,
    selectChannel,
    openThread,
    closeThread,
    loadChannelMessages,
    loadThreadReplies,
    sendToChannel,
    sendToThread,
    createChannel,
    updateChannel,
    archiveChannel,
    setMemberMute,
    clearError,
  ]);

  return <GroupChatContext.Provider value={value}>{children}</GroupChatContext.Provider>;
}

export function useGroupChat(): GroupChatContextValue {
  const ctx = useContext(GroupChatContext);
  if (!ctx) {
    throw new Error('useGroupChat must be used inside <GroupChatProvider>');
  }
  return ctx;
}

// =====================================================================
// Helpers
// =====================================================================

function appendMessage(
  bucketMap: Record<number, ChatGroupMessage[]>,
  bucketId: number,
  msg: ChatGroupMessage,
): Record<number, ChatGroupMessage[]> {
  const existing = bucketMap[bucketId] ?? [];
  return { ...bucketMap, [bucketId]: [...existing, msg] };
}

function dedupeMessagesById(msgs: ChatGroupMessage[]): ChatGroupMessage[] {
  const seen = new Set<number>();
  const out: ChatGroupMessage[] = [];
  for (const m of msgs) {
    if (m.id <= 0) {
      // Negative ids are optimistic stubs from in-flight stream — keep them
      // (the reconciler will replace once a real reload happens).
      out.push(m);
      continue;
    }
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

function formatStreamError(ev: GroupChatErrorEvent | { category: 'transport'; hint: string; detail?: string }): string {
  const detail = (ev as GroupChatErrorEvent).detail ?? '';
  return detail ? `${ev.hint}: ${detail}` : ev.hint;
}
