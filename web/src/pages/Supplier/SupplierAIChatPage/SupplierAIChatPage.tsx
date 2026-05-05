import React, { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Send, Plus, PanelLeftClose, Sparkles, Search } from 'lucide-react';
import { useChat } from '../../../contexts/ChatContext';
import { ToolCallCard } from '../../../components/AI/AIPanel/ToolCallCard';
import styles from './SupplierAIChatPage.module.css';

interface AIChatPageProps {
  role: 'supplier' | 'admin';
  backPath: string;
}

export const AIChatPage: React.FC<AIChatPageProps> = ({ role, backPath }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    messages, isLoading, sendMessage, newSession, setUserRole,
    toolCalls, sessions, isSessionsLoading, loadSessions, loadSession,
    sessionId,
  } = useChat();

  const [input, setInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setUserRole(role);
    loadSessions();
    return () => setUserRole('user');
  }, [role, setUserRole, loadSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolCalls]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    sendMessage(trimmed);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isComposing]);

  const filteredSessions = sessions.filter(s =>
    !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('chat.justNow', '刚刚');
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>💬 {t('aiPanel.sessions', '会话列表')}</span>
          <button className={styles.newBtn} onClick={newSession} title={t('aiPanel.newChat', '新对话')}>
            <Plus size={16} />
          </button>
        </div>
        <div className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder={t('aiPanel.searchSessions', '搜索会话...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.sessionList}>
          {isSessionsLoading ? (
            <div className={styles.sessionEmpty}>{t('common.loading', '加载中...')}</div>
          ) : filteredSessions.length === 0 ? (
            <div className={styles.sessionEmpty}>{t('chat.noHistory', '暂无历史对话')}</div>
          ) : (
            filteredSessions.map(s => (
              <button
                key={s.id}
                className={`${styles.sessionItem} ${s.id === sessionId ? styles.sessionActive : ''}`}
                onClick={() => loadSession(s.id)}
              >
                <span className={styles.sessionTitle}>{s.title || t('chat.untitledChat', '对话')}</span>
                <span className={styles.sessionTime}>{formatTime(s.updated_at)}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.collapseBtn} onClick={() => navigate(backPath)}>
              <PanelLeftClose size={16} />
              <span>{t('aiPanel.backToPanel', '返回')}</span>
            </button>
            <span className={styles.chatTitle}>
              {sessions.find(s => s.id === sessionId)?.title || t('aiPanel.brand', '畅游南澳AI')}
            </span>
          </div>
          <div className={styles.topbarRight}>
            <button className={styles.newChatBtn} onClick={newSession}>
              <Plus size={14} /> {t('aiPanel.newChat', '新对话')}
            </button>
          </div>
        </header>

        <div className={styles.chatArea}>
          <div className={styles.chatInner}>
            <div className={styles.messages}>
              {messages.length === 0 ? (
                <div className={styles.welcome}>
                  <Sparkles size={40} className={styles.welcomeIcon} />
                  <h2 className={styles.welcomeTitle}>{t('aiPanel.brand', '畅游南澳AI')}</h2>
                  <p className={styles.welcomeDesc}>{t('aiPanel.welcomeDesc', '有什么可以帮您的吗？')}</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
                    <div className={styles.bubbleLabel}>
                      {msg.role === 'user' ? t('aiPanel.you', '您') : t('aiPanel.brand', '畅游南澳AI')}
                    </div>
                    <div className={styles.bubbleContent}>
                      {msg.content || (isLoading && i === messages.length - 1 ? (
                        <span className={styles.typing}>
                          <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
                        </span>
                      ) : '...')}
                    </div>
                  </div>
                ))
              )}
              {toolCalls.map(tc => (
                <ToolCallCard key={tc.id} toolCall={tc} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder={t('aiPanel.inputPlaceholder', '输入消息... (Enter 发送, Shift+Enter 换行)')}
                rows={1}
              />
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIChatPage;
