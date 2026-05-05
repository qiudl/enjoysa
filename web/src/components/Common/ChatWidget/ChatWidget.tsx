import React, { useRef, useEffect, useState, useCallback, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X, Trash2, Send, Sparkles, Globe, Loader2, Clock, ArrowLeft, Plus } from 'lucide-react';
import { useChat } from '../../../contexts/ChatContext';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import styles from './ChatWidget.module.css';

const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' },
  { code: 'zh-TW', label: '繁體中文' },
];

export const ChatWidget: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const {
    messages, isOpen, isLoading, isHistoryLoading,
    chatLanguage, setChatLanguage,
    toggleChat, sendMessage, clearChat,
    userMessageCount, signupDismissed, dismissSignup,
    showHistory, setShowHistory, sessions, isSessionsLoading,
    loadSessions, loadSession, newSession,
  } = useChat();
  const { isAuthenticated } = useUserAuth();

  // Hide on supplier/admin pages — they use the AIPanel instead
  const isBackendRoute = location.pathname.startsWith('/supplier') || location.pathname.startsWith('/admin');
  if (isBackendRoute) return null;
  const [input, setInput] = useState('');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Close language menu on outside click
  useEffect(() => {
    if (!showLangMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showLangMenu]);

  const handleSend = (text?: string) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isLoading || trimmed.length > 4000) return;
    if (!text) setInput('');
    sendMessage(trimmed);
  };

  const [isComposing, setIsComposing] = useState(false);
  const handleCompositionStart = useCallback(() => setIsComposing(true), []);
  const handleCompositionEnd = useCallback(() => setIsComposing(false), []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLangSelect = (code: string) => {
    setChatLanguage(code);
    setShowLangMenu(false);
  };

  const quickQuestions = [
    t('chat.quickAsk1'),
    t('chat.quickAsk2'),
    t('chat.quickAsk3'),
  ];

  // Show signup nudge after 1st AI reply (guest only, once per session)
  const showSignupNudge = !isAuthenticated && userMessageCount >= 1 && !isLoading && !signupDismissed;

  const handleHistoryClick = () => {
    setShowHistory(true);
    loadSessions();
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('chat.justNow', 'Just now');
    if (mins < 60) return t('chat.minutesAgo', '{{n}} min ago', { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('chat.hoursAgo', '{{n}}h ago', { n: hours });
    const days = Math.floor(hours / 24);
    return t('chat.daysAgo', '{{n}}d ago', { n: days });
  };

  return (
    <>
      {/* Floating Button */}
      <button className={styles.chatButton} onClick={toggleChat} aria-label={t('chat.title')}>
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className={styles.chatPanel}>
          {/* Header */}
          <div className={styles.chatHeader}>
            <div className={styles.chatTitle}>
              {showHistory ? (
                <>
                  <button className={styles.headerBtn} onClick={() => setShowHistory(false)}>
                    <ArrowLeft size={16} />
                  </button>
                  {t('chat.historyTitle', 'Chat History')}
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  {t('chat.title', 'AI Travel Assistant')}
                </>
              )}
            </div>
            <div className={styles.headerActions}>
              {showHistory ? (
                <button className={styles.headerBtn} onClick={newSession} title={t('chat.newChat', 'New Chat')}>
                  <Plus size={16} />
                </button>
              ) : (
                <>
                  {/* History Button - only for authenticated users */}
                  {isAuthenticated && (
                    <button
                      className={styles.headerBtn}
                      onClick={handleHistoryClick}
                      title={t('chat.historyTitle', 'Chat History')}
                    >
                      <Clock size={16} />
                    </button>
                  )}
                  {/* Language Selector */}
                  <div className={styles.langWrapper} ref={langMenuRef}>
                    <button
                      className={styles.headerBtn}
                      onClick={() => setShowLangMenu(prev => !prev)}
                      title={t('chat.langLabel', 'Language')}
                    >
                      <Globe size={16} />
                    </button>
                    {showLangMenu && (
                      <div className={styles.langMenu}>
                        {LANGUAGES.map(lang => (
                          <button
                            key={lang.code}
                            className={`${styles.langOption} ${chatLanguage === lang.code ? styles.langActive : ''}`}
                            onClick={() => handleLangSelect(lang.code)}
                          >
                            {lang.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className={styles.headerBtn} onClick={clearChat} title={t('chat.clearHistory', 'Clear')}>
                    <Trash2 size={16} />
                  </button>
                </>
              )}
              <button className={styles.headerBtn} onClick={toggleChat}>
                <X size={16} />
              </button>
            </div>
          </div>

          {showHistory ? (
            /* History List View */
            <div className={styles.chatMessages}>
              {isSessionsLoading ? (
                <div className={styles.historyLoading}>
                  <Loader2 size={20} className={styles.spinner} />
                  <span>{t('chat.historyLoading', 'Loading history...')}</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className={styles.historyEmpty}>
                  <Clock size={32} />
                  <p>{t('chat.noHistory', 'No chat history yet')}</p>
                </div>
              ) : (
                sessions.map(session => (
                  <button
                    key={session.id}
                    className={styles.sessionItem}
                    onClick={() => loadSession(session.id)}
                  >
                    <div className={styles.sessionTitle}>
                      {session.title || t('chat.untitledChat', 'Chat')}
                    </div>
                    <div className={styles.sessionTime}>
                      {formatRelativeTime(session.updated_at)}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className={styles.chatMessages}>
                {isHistoryLoading && (
                  <div className={styles.historyLoading}>
                    <Loader2 size={20} className={styles.spinner} />
                    <span>{t('chat.historyLoading', 'Loading history...')}</span>
                  </div>
                )}

                {!isHistoryLoading && messages.length === 0 && (
                  <div className={styles.welcomeCard}>
                    <div className={styles.welcomeAvatar}>
                      <Sparkles size={24} />
                    </div>
                    <p className={styles.welcomeText}>{t('chat.welcome')}</p>
                    <div className={styles.quickChips}>
                      {quickQuestions.map((q, i) => (
                        <button
                          key={i}
                          className={styles.chip}
                          onClick={() => handleSend(q)}
                          disabled={isLoading}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}
                  >
                    {msg.content}
                  </div>
                ))}

                {/* Signup nudge card */}
                {showSignupNudge && (
                  <div className={styles.signupCard}>
                    <p className={styles.signupText}>{t('chat.signupHint')}</p>
                    <div className={styles.signupActions}>
                      <a href="/login" className={styles.signupBtn}>{t('chat.signupBtn')}</a>
                      <button className={styles.signupDismiss} onClick={dismissSignup}>
                        {t('chat.dismissBtn', 'Later')}
                      </button>
                    </div>
                  </div>
                )}

                {isLoading && messages[messages.length - 1]?.content === '' && (
                  <div className={styles.typing}>
                    <span className={styles.typingDot} />
                    <span className={styles.typingDot} />
                    <span className={styles.typingDot} />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className={styles.chatInput}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  placeholder={t('chat.placeholder', 'Type your message...')}
                  rows={1}
                />
                <button
                  className={styles.sendBtn}
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  aria-label={t('chat.send', 'Send')}
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ChatWidget;
