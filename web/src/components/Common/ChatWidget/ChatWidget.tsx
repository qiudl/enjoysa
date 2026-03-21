import React, { useRef, useEffect, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X, Trash2, Send, Sparkles } from 'lucide-react';
import { useChat } from '../../../contexts/ChatContext';
import styles from './ChatWidget.module.css';

export const ChatWidget: React.FC = () => {
  const { t } = useTranslation();
  const { messages, isOpen, isLoading, toggleChat, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
              <Sparkles size={18} />
              {t('chat.title', 'AI Travel Assistant')}
            </div>
            <div className={styles.headerActions}>
              <button className={styles.headerBtn} onClick={clearChat} title={t('chat.clearHistory', 'Clear')}>
                <Trash2 size={16} />
              </button>
              <button className={styles.headerBtn} onClick={toggleChat}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className={styles.chatMessages}>
            {messages.length === 0 && (
              <div className={styles.emptyState}>
                <MessageCircle size={32} />
                <p className={styles.emptyHint}>{t('chat.emptyHint', 'Ask me anything about South Australia travel!')}</p>
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
              placeholder={t('chat.placeholder', 'Type your message...')}
              rows={1}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label={t('chat.send', 'Send')}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
