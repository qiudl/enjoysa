import React, { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Send, Maximize2, PanelRightClose, Plus, Sparkles } from 'lucide-react';
import { useChat } from '../../../contexts/ChatContext';
import { AIPanelFeed } from './AIPanelFeed';
import { AIPanelTools, type ToolCategory } from './AIPanelTools';
import { ToolCallCard } from './ToolCallCard';
import styles from './AIPanel.module.css';
import clsx from 'clsx';

export type AIRole = 'supplier' | 'admin';
type TabKey = 'chat' | 'feed' | 'tools';

const STORAGE_KEY = 'enjoysa_ai_panel_collapsed';

interface AIPanelProps {
  role: AIRole;
  toolCategories: ToolCategory[];
  hasUnreadNotifications?: boolean;
  onViewAllNotifications?: () => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({
  role,
  toolCategories,
  hasUnreadNotifications = false,
  onViewAllNotifications,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    messages, isLoading, sendMessage, newSession, setUserRole, toolCalls,
  } = useChat();

  // Set user role for chat context
  useEffect(() => {
    setUserRole(role);
    return () => setUserRole('user');
  }, [role, setUserRole]);

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [activeTab, setActiveTab] = useState<TabKey>('chat');
  const [input, setInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const togglePanel = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* */ }
      return next;
    });
  }, []);

  const handleSwitchTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    if (collapsed) {
      setCollapsed(false);
      try { localStorage.setItem(STORAGE_KEY, 'false'); } catch { /* */ }
    }
  }, [collapsed]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleCompositionStart = useCallback(() => setIsComposing(true), []);
  const handleCompositionEnd = useCallback(() => setIsComposing(false), []);

  const handleToolClick = useCallback((path?: string) => {
    if (path) navigate(path);
  }, [navigate]);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'chat', label: t('aiPanel.tab.chat', '对话'), icon: '💬' },
    { key: 'feed', label: t('aiPanel.tab.feed', '动态'), icon: '⚡' },
    { key: 'tools', label: t('aiPanel.tab.tools', '工具'), icon: '🔧' },
  ];

  return (
    <div className={clsx(styles.panel, collapsed && styles.collapsed)}>
      {/* Collapsed bar */}
      <div className={styles.collapsedBar}>
        <button
          className={clsx(styles.collapsedBrand, styles[role])}
          onClick={togglePanel}
          title={t('aiPanel.expand', '展开畅游南澳AI')}
        >
          <Sparkles size={16} />
        </button>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={clsx(styles.collapsedTabIcon, activeTab === tab.key && styles.active)}
            onClick={() => handleSwitchTab(tab.key)}
            title={tab.label}
          >
            {tab.icon}
            {tab.key === 'feed' && hasUnreadNotifications && <span className={styles.miniDot} />}
          </button>
        ))}
      </div>

      {/* Expanded content */}
      <div className={styles.expandedContent}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.brand}>
            <div className={clsx(styles.brandIcon, styles[role])}>
              <Sparkles size={14} />
            </div>
            <span className={styles.brandName}>{t('aiPanel.brand', '畅游南澳AI')}</span>
          </div>
          <div className={styles.headerActions}>
            {activeTab === 'chat' && (
              <button className={styles.actionBtn} onClick={newSession} title={t('aiPanel.newChat', '新对话')}>
                <Plus size={16} />
              </button>
            )}
            <button
              className={styles.actionBtn}
              onClick={() => navigate(role === 'supplier' ? '/supplier/ai-chat' : '/admin/ai-chat')}
              title={t('aiPanel.fullscreen', '全屏')}
            >
              <Maximize2 size={14} />
            </button>
            <button className={styles.actionBtn} onClick={togglePanel} title={t('aiPanel.collapse', '折叠')}>
              <PanelRightClose size={16} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className={styles.tabBar}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={clsx(styles.tabBtn, activeTab === tab.key && styles.active)}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon} {tab.label}
              {tab.key === 'feed' && hasUnreadNotifications && <span className={styles.tabDot} />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={styles.tabContent}>
          {/* Chat */}
          <div className={clsx(styles.tabPane, activeTab === 'chat' && styles.active)}>
            <div className={styles.chatMessages}>
              {messages.length === 0 ? (
                <div className={styles.chatWelcome}>
                  <div className={styles.welcomeIcon}><Sparkles size={32} /></div>
                  <div className={styles.welcomeTitle}>{t('aiPanel.brand', '畅游南澳AI')}</div>
                  <div className={styles.welcomeDesc}>{t('aiPanel.welcomeDesc', '有什么可以帮您的吗？')}</div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} className={clsx(styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant)}>
                      <div className={styles.bubbleLabel}>
                        {msg.role === 'user' ? t('aiPanel.you', '您') : t('aiPanel.brand', '畅游南澳AI')}
                      </div>
                      <div className={styles.bubbleContent}>
                        {msg.content || (isLoading && i === messages.length - 1 ? (
                          <div className={styles.typing}>
                            <span className={styles.typingDot} />
                            <span className={styles.typingDot} />
                            <span className={styles.typingDot} />
                          </div>
                        ) : '...')}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {toolCalls.map(tc => (
                    <ToolCallCard key={tc.id} toolCall={tc} />
                  ))}
              <div ref={messagesEndRef} />
            </div>
            <div className={styles.chatInput}>
              <textarea
                ref={textareaRef}
                className={styles.chatTextarea}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder={t('aiPanel.inputPlaceholder', '输入消息...')}
                rows={1}
              />
              <button
                className={styles.chatExpandBtn}
                onClick={() => navigate(role === 'supplier' ? '/supplier/ai-chat' : '/admin/ai-chat')}
                title={t('aiPanel.fullscreen', '全屏对话')}
              >
                <Maximize2 size={14} />
              </button>
              <button
                className={styles.chatSendBtn}
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                <Send size={15} />
              </button>
            </div>
          </div>

          {/* Feed */}
          <div className={clsx(styles.tabPane, activeTab === 'feed' && styles.active)}>
            <AIPanelFeed
              role={role}
              onViewAll={onViewAllNotifications}
            />
          </div>

          {/* Tools */}
          <div className={clsx(styles.tabPane, activeTab === 'tools' && styles.active)}>
            <AIPanelTools
              categories={toolCategories}
              onToolClick={handleToolClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPanel;
