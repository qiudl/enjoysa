import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { sendMessageStream, type ChatMessage } from '../services/chatService';
import { useTranslation } from 'react-i18next';

interface ChatContextType {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  sessionId: number | null;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  sendMessage: (content: string, pageContext?: string) => Promise<void>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const { i18n } = useTranslation();

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen(prev => !prev), []);

  const sendMessage = useCallback(async (content: string, pageContext?: string) => {
    const userMsg: ChatMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Add placeholder for assistant response
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      await sendMessageStream(content, {
        onSessionId: (id) => setSessionId(id),
        onToken: (token) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + token };
            }
            return updated;
          });
        },
        onDone: () => {
          setIsLoading(false);
        },
        onError: (error) => {
          console.error('[Chat] stream error:', error);
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant' && last.content === '') {
              updated[updated.length - 1] = { ...last, content: '...' };
            }
            return updated;
          });
          setIsLoading(false);
        },
      }, {
        sessionId: sessionId ?? undefined,
        language: i18n.language,
        pageContext,
      });
    } catch {
      setIsLoading(false);
    }
  }, [sessionId, i18n.language]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
  }, []);

  return (
    <ChatContext.Provider value={{
      messages, isOpen, isLoading, sessionId,
      openChat, closeChat, toggleChat, sendMessage, clearChat,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
