/**
 * ChannelSidebar — REQ-20260509-0037 dev-8 + dev-10.
 *
 * Left rail: workspace header + scrollable channel list + "+" button to open
 * CreateChannelModal (dev-10). Each channel row shows `#name`, agent color
 * dots, and active-state highlight; clicking routes through selectChannel.
 *
 * Defers (post-dev-10):
 *   - Unread red dot
 *   - Archive UI
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

import { useGroupChat } from '../../../contexts/GroupChatContext';
import { CreateChannelModal } from './CreateChannelModal';
import styles from './ChannelSidebar.module.css';

export function ChannelSidebar() {
  const { t } = useTranslation();
  const { workspace, channels, agents, activeChannelId, selectChannel, isBootstrapping } = useGroupChat();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const agentById = new Map(agents.map(a => [a.id, a]));

  return (
    <aside className={styles.sidebar} aria-label={t('groupChat.sidebar.aria')}>
      <header className={styles.header}>
        <div className={styles.brand}>{t('groupChat.brand')}</div>
        <div className={styles.workspaceMeta}>
          {workspace ? t('groupChat.workspaceLabel', { id: workspace.id }) : t('groupChat.loading')}
        </div>
      </header>

      <div className={styles.channelHeading}>
        <span>{t('groupChat.sidebar.channelsHeading')}</span>
        <button
          type="button"
          className={styles.newChannelBtn}
          onClick={() => setShowCreateModal(true)}
          aria-label={t('groupChat.sidebar.newChannel')}
          title={t('groupChat.sidebar.newChannel')}
        >
          <Plus size={14} aria-hidden />
        </button>
      </div>

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

      {showCreateModal && (
        <CreateChannelModal
          onClose={() => setShowCreateModal(false)}
          onCreated={id => void selectChannel(id)}
        />
      )}
    </aside>
  );
}
