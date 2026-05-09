/**
 * ThreadPanel — REQ-20260509-0037 dev-9.
 *
 * Right column shown only when GroupChatContext.activeThreadParentId is set.
 *   header: "主题" + close button
 *   parent: the message that started the thread
 *   replies: chronological list (older → newer) — independent scroll
 *   composer: textarea + 同时发送到频道 checkbox + send
 *
 * Backend rejects nested threads (defect-analysis T2), so the panel never
 * shows a "在主题中回复" action on its own messages — only on the channel
 * main flow (handled by ChannelMain).
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { useGroupChat } from '../../../contexts/GroupChatContext';
import type { ChatGroupMessage } from '../../../services/groupChatService';
import styles from './ThreadPanel.module.css';

export function ThreadPanel() {
  const { t } = useTranslation();
  const {
    activeThreadParentId,
    threadParents,
    threadsByParent,
    agents,
    streaming,
    isLoadingThread,
    closeThread,
    sendToThread,
  } = useGroupChat();

  const [draft, setDraft] = useState('');
  const [alsoInChannel, setAlsoInChannel] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const parentId = activeThreadParentId;
  const parent = parentId ? threadParents[parentId] : undefined;
  const replies = parentId ? (threadsByParent[parentId] ?? []) : [];
  const agentById = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents]);
  const isStreamingHere = streaming.threadParentId !== null && streaming.threadParentId === parentId;
  const isLoading = parentId ? !!isLoadingThread[parentId] : false;

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [replies.length, streaming.assembledContent, streaming.status]);

  // Reset composer + checkbox when switching threads.
  useEffect(() => {
    setDraft('');
    setAlsoInChannel(false);
  }, [parentId]);

  if (!parentId || !parent) return null;

  const onSubmit = async (e: FormEvent | KeyboardEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || isStreamingHere) return;
    setDraft('');
    try {
      await sendToThread(parentId, { content, also_in_channel: alsoInChannel });
    } catch {
      /* lastError surfaces via context toast */
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      void onSubmit(e);
    }
  };

  return (
    <aside className={styles.panel} aria-label={t('groupChat.thread.aria')}>
      <header className={styles.header}>
        <span className={styles.title}>{t('groupChat.thread.title')}</span>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={closeThread}
          aria-label={t('groupChat.thread.close')}
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      <div ref={scrollRef} className={styles.body}>
        <ParentCard message={parent} agentName={getSenderDisplay(parent, agentById)} agentColor={getSenderColor(parent, agentById)} />
        <div className={styles.replyDivider} aria-hidden>
          {t('groupChat.thread.replyCount', { count: replies.length })}
        </div>

        {isLoading && replies.length === 0 && (
          <div className={styles.systemNote}>{t('groupChat.loading')}</div>
        )}
        {replies.map(r => (
          <ReplyBubble key={r.id} message={r} agentName={getSenderDisplay(r, agentById)} agentColor={getSenderColor(r, agentById)} />
        ))}
        {isStreamingHere && (streaming.assembledContent || streaming.status) && (
          <div className={styles.bubble} data-role="ai" data-streaming="true">
            <div className={styles.bubbleHeader}>
              <span className={styles.senderName}>
                {streaming.routeAgentId ? agentById.get(streaming.routeAgentId)?.name : t('groupChat.streaming.responder')}
              </span>
              {streaming.status && <span className={styles.statusInline}>{streaming.status}</span>}
            </div>
            <div className={styles.bubbleBody}>{streaming.assembledContent || '…'}</div>
          </div>
        )}
      </div>

      <form className={styles.composer} onSubmit={onSubmit}>
        <label className={styles.alsoInChannel}>
          <input
            type="checkbox"
            checked={alsoInChannel}
            onChange={e => setAlsoInChannel(e.target.checked)}
            disabled={isStreamingHere}
          />
          {t('groupChat.thread.alsoInChannel')}
        </label>
        <textarea
          className={styles.composerInput}
          rows={2}
          placeholder={t('groupChat.thread.composerPlaceholder')}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={isStreamingHere}
          aria-label={t('groupChat.thread.composerAria')}
        />
        <button
          type="submit"
          className={styles.composerSend}
          disabled={isStreamingHere || draft.trim().length === 0}
        >
          {isStreamingHere ? t('groupChat.composer.sending') : t('groupChat.composer.send')}
        </button>
      </form>
    </aside>
  );
}

function ParentCard({
  message,
  agentName,
  agentColor,
}: {
  message: ChatGroupMessage;
  agentName: string;
  agentColor: string | null;
}) {
  return (
    <div
      className={`${styles.bubble} ${styles.parentCard}`}
      data-role={message.sender_type === 'user' ? 'user' : 'ai'}
      style={agentColor ? { borderLeftColor: agentColor } : undefined}
    >
      <div className={styles.bubbleHeader}>
        <span className={styles.senderName}>{agentName}</span>
      </div>
      <div className={styles.bubbleBody}>{message.content}</div>
    </div>
  );
}

function ReplyBubble({
  message,
  agentName,
  agentColor,
}: {
  message: ChatGroupMessage;
  agentName: string;
  agentColor: string | null;
}) {
  const isUser = message.sender_type === 'user' || message.sender_type === 'human';
  return (
    <div
      className={styles.bubble}
      data-role={isUser ? 'user' : 'ai'}
      style={!isUser && agentColor ? { borderLeftColor: agentColor } : undefined}
    >
      <div className={styles.bubbleHeader}>
        <span className={styles.senderName}>{agentName}</span>
        {message.also_in_channel && (
          <span className={styles.alsoInChannelTag} title="同时贴回主流">↪︎</span>
        )}
      </div>
      <div className={styles.bubbleBody}>{message.content}</div>
    </div>
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
