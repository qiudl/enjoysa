/**
 * ChannelMain — REQ-20260509-0037 dev-8 + dev-9.
 *
 * Center column: channel topbar + main-flow message list + composer.
 *
 * Streaming display contract:
 *   - As `streaming.assembledContent` arrives, the in-progress assistant
 *     bubble appears at the bottom with the routed agent's color stripe.
 *   - When `streaming.status` is non-empty (e.g. "正在识别图片..."), it
 *     replaces the typing indicator until content starts flowing.
 *   - On `done`, the optimistic assistant message in messagesByChannel is
 *     authoritative — the live `assembled` clears.
 *
 * dev-9 additions:
 *   - Hover action "在主题中回复" on each main-flow message → opens ThreadPanel.
 *   - "N 条回复" badge under messages that already have a thread.
 *
 * Defers (dev-10):
 *   - @mention dropdown
 *   - Tool call / tool result inline cards
 *   - Image upload UI
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';

import { useGroupChat } from '../../../contexts/GroupChatContext';
import type { ChatAgent, ChatGroupMessage } from '../../../services/groupChatService';
import { applyMention, detectMentionContext, extractMentionIds, filterMentionCandidates } from './mention';
import styles from './ChannelMain.module.css';

export function ChannelMain() {
  const { t } = useTranslation();
  const {
    channels,
    agents,
    activeChannelId,
    activeThreadParentId,
    messagesByChannel,
    threadReplyCounts,
    streaming,
    isLoadingChannel,
    sendToChannel,
    openThread,
  } = useGroupChat();

  const [draft, setDraft] = useState('');
  const [mentionState, setMentionState] = useState<{ atIndex: number; query: string; activeIndex: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChannel = useMemo(
    () => channels.find(c => c.id === activeChannelId) || null,
    [channels, activeChannelId],
  );
  const messages = activeChannelId ? (messagesByChannel[activeChannelId] ?? []) : [];
  const agentById = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents]);
  const isStreamingHere = streaming.channelId !== null && streaming.channelId === activeChannelId;
  const isLoading = activeChannelId ? !!isLoadingChannel[activeChannelId] : false;

  // Mention dropdown candidates: prioritize channel members, fall back to all
  // agents (so users can pull a non-member agent into a thread later).
  const mentionCandidates = useMemo<ChatAgent[]>(() => {
    if (!activeChannel) return [];
    const memberIds = new Set(activeChannel.member_agent_ids);
    const members = agents.filter(a => memberIds.has(a.id));
    const others = agents.filter(a => !memberIds.has(a.id));
    return [...members, ...others];
  }, [activeChannel, agents]);

  const mentionMatches = useMemo<ChatAgent[]>(
    () => (mentionState ? filterMentionCandidates(mentionCandidates, mentionState.query).slice(0, 8) : []),
    [mentionCandidates, mentionState],
  );

  // Auto-scroll the message list to the bottom when new messages or stream
  // chunks arrive. Smooth scroll for new messages, instant for stream chunks
  // so we don't fight the user mid-read.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, streaming.assembledContent, streaming.status]);

  if (!activeChannel) {
    return (
      <main className={styles.main}>
        <div className={styles.emptyChannel}>{t('groupChat.empty.noChannel')}</div>
      </main>
    );
  }

  const onSubmit = async (e: FormEvent | KeyboardEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || isStreamingHere) return;
    setDraft('');
    setMentionState(null);
    const mentions = extractMentionIds(content, agents);
    try {
      await sendToChannel(activeChannel.id, { content, mentions });
    } catch {
      // Errors land in lastError via the context; the page-level toast
      // surfaces them. Restoring the draft would be hostile to the user
      // (they'd retype) — we leave the box empty.
    }
  };

  const refreshMentionState = (text: string, caret: number) => {
    const ctx = detectMentionContext(text, caret);
    if (!ctx) {
      setMentionState(null);
      return;
    }
    setMentionState({ atIndex: ctx.atIndex, query: ctx.query, activeIndex: 0 });
  };

  const insertMention = (agent: ChatAgent) => {
    const ta = textareaRef.current;
    if (!ta || !mentionState) return;
    const caret = ta.selectionStart ?? draft.length;
    const next = applyMention(draft, mentionState.atIndex, caret, agent.name);
    setDraft(next.text);
    setMentionState(null);
    // Restore caret position after React updates the value.
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(next.caret, next.caret);
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention dropdown navigation/selection takes priority over send.
    if (mentionState && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionState(s => s && { ...s, activeIndex: (s.activeIndex + 1) % mentionMatches.length });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionState(s => s && { ...s, activeIndex: (s.activeIndex - 1 + mentionMatches.length) % mentionMatches.length });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (!e.nativeEvent.isComposing) {
          e.preventDefault();
          insertMention(mentionMatches[mentionState.activeIndex]);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionState(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      void onSubmit(e);
    }
  };

  return (
    <main className={styles.main}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.channelTitle}># {activeChannel.name}</span>
          {activeChannel.description && (
            <span className={styles.channelDesc}>{activeChannel.description}</span>
          )}
        </div>
        <div className={styles.topbarRight}>
          {activeChannel.member_agent_ids.map(id => {
            const a = agentById.get(id);
            if (!a) return null;
            return (
              <span key={id} className={styles.memberPill} title={a.name}>
                <span className={styles.memberDot} style={{ background: a.color_hex || '#94a3b8' }} />
                {a.avatar_emoji || '🤖'} {a.name}
              </span>
            );
          })}
        </div>
      </header>

      <div ref={scrollRef} className={styles.messages}>
        {isLoading && messages.length === 0 && (
          <div className={styles.systemNote}>{t('groupChat.loading')}</div>
        )}
        {messages.length === 0 && !isLoading && (
          <div className={styles.systemNote}>{t('groupChat.empty.noMessages')}</div>
        )}
        {messages.map(m => (
          <MessageBubble
            key={m.id}
            message={m}
            agentName={getSenderDisplay(m, agentById)}
            agentColor={getSenderColor(m, agentById)}
            replyCount={m.id > 0 ? (threadReplyCounts[m.id] ?? 0) : 0}
            isActiveThreadParent={m.id === activeThreadParentId}
            onOpenThread={() => void openThread(m)}
            replyLabel={t('groupChat.thread.replyAction')}
            countLabel={(n: number) => t('groupChat.thread.replyCount', { count: n })}
          />
        ))}
        {isStreamingHere && (streaming.assembledContent || streaming.status) && (
          <div className={styles.bubble} data-role="ai" data-streaming="true">
            <div className={styles.bubbleHeader}>
              <span className={styles.senderName}>
                {streaming.routeAgentId ? agentById.get(streaming.routeAgentId)?.name : t('groupChat.streaming.responder')}
              </span>
              {streaming.status && <span className={styles.statusInline}>{streaming.status}</span>}
            </div>
            <div className={styles.bubbleBody}>
              {streaming.assembledContent || <TypingDots />}
            </div>
          </div>
        )}
      </div>

      <form className={styles.composer} onSubmit={onSubmit}>
        {mentionState && mentionMatches.length > 0 && (
          <div className={styles.mentionDropdown} role="listbox" aria-label={t('groupChat.mention.aria')}>
            {mentionMatches.map((a, i) => {
              const isMember = activeChannel.member_agent_ids.includes(a.id);
              const isActive = i === mentionState.activeIndex;
              return (
                <button
                  type="button"
                  key={a.id}
                  className={`${styles.mentionRow} ${isActive ? styles.mentionRowActive : ''}`}
                  data-non-member={!isMember || undefined}
                  onMouseDown={e => { e.preventDefault(); insertMention(a); }}
                  role="option"
                  aria-selected={isActive}
                >
                  <span className={styles.memberDot} style={{ background: a.color_hex || '#94a3b8' }} />
                  <span className={styles.mentionName}>{a.avatar_emoji || '🤖'} {a.name}</span>
                  {!isMember && <span className={styles.nonMemberTag}>{t('groupChat.mention.nonMember')}</span>}
                </button>
              );
            })}
          </div>
        )}
        <textarea
          ref={textareaRef}
          className={styles.composerInput}
          rows={2}
          placeholder={t('groupChat.composer.placeholder', { channel: activeChannel.name })}
          value={draft}
          onChange={e => {
            setDraft(e.target.value);
            refreshMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyUp={e => {
            const ta = e.currentTarget;
            refreshMentionState(ta.value, ta.selectionStart ?? ta.value.length);
          }}
          onClick={e => {
            const ta = e.currentTarget;
            refreshMentionState(ta.value, ta.selectionStart ?? ta.value.length);
          }}
          onKeyDown={onKeyDown}
          disabled={isStreamingHere}
          aria-label={t('groupChat.composer.aria')}
        />
        <button
          type="submit"
          className={styles.composerSend}
          disabled={isStreamingHere || draft.trim().length === 0}
        >
          {isStreamingHere ? t('groupChat.composer.sending') : t('groupChat.composer.send')}
        </button>
      </form>
    </main>
  );
}

function MessageBubble({
  message,
  agentName,
  agentColor,
  replyCount,
  isActiveThreadParent,
  onOpenThread,
  replyLabel,
  countLabel,
}: {
  message: ChatGroupMessage;
  agentName: string;
  agentColor: string | null;
  replyCount: number;
  isActiveThreadParent: boolean;
  onOpenThread: () => void;
  replyLabel: string;
  countLabel: (n: number) => string;
}) {
  const isUser = message.sender_type === 'user';
  const isOptimisticStub = message.id <= 0;

  return (
    <div
      className={styles.bubbleWrapper}
      data-active-thread={isActiveThreadParent ? 'true' : undefined}
    >
      <div
        className={styles.bubble}
        data-role={isUser ? 'user' : 'ai'}
        style={!isUser && agentColor ? { borderLeftColor: agentColor } : undefined}
      >
        <div className={styles.bubbleHeader}>
          <span className={styles.senderName}>{agentName}</span>
        </div>
        <div className={styles.bubbleBody}>{message.content}</div>
        {replyCount > 0 && (
          <button
            type="button"
            className={styles.replyCountBadge}
            onClick={onOpenThread}
            title={replyLabel}
          >
            <MessageSquare size={12} aria-hidden /> {countLabel(replyCount)}
          </button>
        )}
      </div>
      {!isOptimisticStub && (
        <button
          type="button"
          className={styles.hoverAction}
          onClick={onOpenThread}
          title={replyLabel}
          aria-label={replyLabel}
        >
          <MessageSquare size={14} aria-hidden /> {replyLabel}
        </button>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className={styles.typing} aria-label="typing">
      <span /> <span /> <span />
    </span>
  );
}

function getSenderDisplay(
  m: ChatGroupMessage,
  agentById: Map<number, { name: string; color_hex: string }>,
): string {
  if (m.sender_type === 'user' || m.sender_type === 'human') return '我';
  if (m.sender_agent_id) return agentById.get(m.sender_agent_id)?.name ?? `agent#${m.sender_agent_id}`;
  return m.sender_type;
}

function getSenderColor(
  m: ChatGroupMessage,
  agentById: Map<number, { name: string; color_hex: string }>,
): string | null {
  if (!m.sender_agent_id) return null;
  return agentById.get(m.sender_agent_id)?.color_hex ?? null;
}
