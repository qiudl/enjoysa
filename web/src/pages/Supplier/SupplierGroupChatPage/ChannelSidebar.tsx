/**
 * ChannelSidebar — REQ-20260509-0037 dev-8.
 *
 * Left rail: workspace header + scrollable channel list. Each row shows
 * `#name`, the channel description (one-line truncated), and small colored
 * dots for the agent members. Active channel is highlighted; clicking a
 * row routes through GroupChatContext.selectChannel.
 *
 * Defers (dev-9 / dev-10):
 *   - "+ New channel" button → CreateChannelModal
 *   - Unread red dot
 *   - Archive UI
 */
import { useTranslation } from 'react-i18next';

import { useGroupChat } from '../../../contexts/GroupChatContext';
import styles from './ChannelSidebar.module.css';

export function ChannelSidebar() {
  const { t } = useTranslation();
  const { workspace, channels, agents, activeChannelId, selectChannel, isBootstrapping } = useGroupChat();

  const agentById = new Map(agents.map(a => [a.id, a]));

  return (
    <aside className={styles.sidebar} aria-label={t('groupChat.sidebar.aria')}>
      <header className={styles.header}>
        <div className={styles.brand}>{t('groupChat.brand')}</div>
        <div className={styles.workspaceMeta}>
          {workspace ? t('groupChat.workspaceLabel', { id: workspace.id }) : t('groupChat.loading')}
        </div>
      </header>

      <nav className={styles.channelList} aria-label={t('groupChat.sidebar.channels')}>
        {isBootstrapping && channels.length === 0 && (
          <div className={styles.empty}>{t('groupChat.loading')}</div>
        )}
        {channels.map(ch => {
          const isActive = ch.id === activeChannelId;
          return (
            <button
              key={ch.id}
              type="button"
              className={`${styles.channelRow} ${isActive ? styles.active : ''}`}
              onClick={() => void selectChannel(ch.id)}
              aria-current={isActive ? 'true' : undefined}
            >
              <span className={styles.channelName}># {ch.name}</span>
              <span className={styles.agentDots} aria-hidden>
                {ch.member_agent_ids.slice(0, 4).map(id => {
                  const a = agentById.get(id);
                  return (
                    <span
                      key={id}
                      className={styles.agentDot}
                      style={{ background: a?.color_hex || '#94a3b8' }}
                      title={a?.name || `agent#${id}`}
                    />
                  );
                })}
                {ch.member_agent_ids.length > 4 && (
                  <span className={styles.agentMore}>+{ch.member_agent_ids.length - 4}</span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
