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
import type { ChatGroupMessage } from '../../../services/groupChatService';
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChannel = useMemo(
    () => channels.find(c => c.id === activeChannelId) || null,
    [channels, activeChannelId],
  );
  const messages = activeChannelId ? (messagesByChannel[activeChannelId] ?? []) : [];
  const agentById = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents]);
  const isStreamingHere = streaming.channelId !== null && streaming.channelId === activeChannelId;
  const isLoading = activeChannelId ? !!isLoadingChannel[activeChannelId] : false;

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
    try {
      await sendToChannel(activeChannel.id, { content });
    } catch {
      // Errors land in lastError via the context; the page-level toast
      // surfaces them. Restoring the draft would be hostile to the user
      // (they'd retype) — we leave the box empty.
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
        <textarea
          className={styles.composerInput}
          rows={2}
          placeholder={t('groupChat.composer.placeholder', { channel: activeChannel.name })}
          value={draft}
          onChange={e => setDraft(e.target.value)}
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
