import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { sendMessageStream, getSessions, getMessages, type ChatMessage } from '../services/chatService';
import { useTranslation } from 'react-i18next';
import { useUserAuth } from './UserAuthContext';

const GUEST_STORAGE_KEY = 'enjoysa_chat_guest';
const GUEST_LANG_KEY = 'enjoysa_chat_lang';
const MAX_GUEST_MESSAGES = 50;
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h

interface GuestData {
  sessionId: number | null;
  messages: ChatMessage[];
  updatedAt: string;
}

interface ChatContextType {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  isHistoryLoading: boolean;
  sessionId: number | null;
  chatLanguage: string;
  setChatLanguage: (lang: string) => void;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  sendMessage: (content: string, pageContext?: string) => Promise<void>;
  clearChat: () => void;
  userMessageCount: number;
  signupDismissed: boolean;
  dismissSignup: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [signupDismissed, setSignupDismissed] = useState(false);
  const { i18n } = useTranslation();
  const { isAuthenticated } = useUserAuth();

  // Chat language: default from i18n, can be overridden
  const [chatLanguage, setChatLanguageState] = useState(() => {
    // Try localStorage for guest preference
    const saved = localStorage.getItem(GUEST_LANG_KEY);
    return saved || i18n.language;
  });

  const initializedRef = useRef(false);
  const prevAuthRef = useRef(isAuthenticated);

  // Sync chatLanguage when i18n language changes (unless user manually set it)
  const manualLangRef = useRef(false);
  useEffect(() => {
    const handleLangChange = (lang: string) => {
      if (!manualLangRef.current) {
        setChatLanguageState(lang);
      }
    };
    i18n.on('languageChanged', handleLangChange);
    return () => { i18n.off('languageChanged', handleLangChange); };
  }, [i18n]);

  const setChatLanguage = useCallback((lang: string) => {
    manualLangRef.current = true;
    setChatLanguageState(lang);
    if (!isAuthenticated) {
      localStorage.setItem(GUEST_LANG_KEY, lang);
    }
  }, [isAuthenticated]);

  // Guest localStorage persistence
  const saveGuestData = useCallback((msgs: ChatMessage[], sid: number | null) => {
    if (isAuthenticated) return;
    const trimmed = msgs.slice(-MAX_GUEST_MESSAGES);
    const data: GuestData = {
      sessionId: sid,
      messages: trimmed,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full, ignore
    }
  }, [isAuthenticated]);

  // Initialize: load history from localStorage (guest) or API (authenticated)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (isAuthenticated) {
      // Load from API
      setIsHistoryLoading(true);
      getSessions().then(sessions => {
        if (sessions.length > 0) {
          const latest = sessions[0];
          const updatedAt = new Date(latest.updated_at).getTime();
          const now = Date.now();
          if (now - updatedAt < SESSION_EXPIRY_MS) {
            // Load messages from recent session
            getMessages(latest.id).then(msgs => {
              if (msgs.length > 0) {
                setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
                setSessionId(latest.id);
                if (latest.language) {
                  setChatLanguageState(latest.language);
                }
              }
              setIsHistoryLoading(false);
            }).catch(() => setIsHistoryLoading(false));
          } else {
            setIsHistoryLoading(false);
          }
        } else {
          setIsHistoryLoading(false);
        }
      }).catch(() => setIsHistoryLoading(false));
    } else {
      // Load from localStorage
      try {
        const saved = localStorage.getItem(GUEST_STORAGE_KEY);
        if (saved) {
          const data: GuestData = JSON.parse(saved);
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(data.messages);
            setSessionId(data.sessionId);
          }
        }
      } catch {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      }
    }
  }, [isAuthenticated]);

  // Handle login/logout transitions
  useEffect(() => {
    if (prevAuthRef.current === isAuthenticated) return;
    prevAuthRef.current = isAuthenticated;

    if (isAuthenticated) {
      // Just logged in: clear guest data, load user history
      localStorage.removeItem(GUEST_STORAGE_KEY);
      setMessages([]);
      setSessionId(null);
      setIsHistoryLoading(true);
      getSessions().then(sessions => {
        if (sessions.length > 0) {
          const latest = sessions[0];
          const updatedAt = new Date(latest.updated_at).getTime();
          if (Date.now() - updatedAt < SESSION_EXPIRY_MS) {
            getMessages(latest.id).then(msgs => {
              if (msgs.length > 0) {
                setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
                setSessionId(latest.id);
                if (latest.language) setChatLanguageState(latest.language);
              }
              setIsHistoryLoading(false);
            }).catch(() => setIsHistoryLoading(false));
          } else {
            setIsHistoryLoading(false);
          }
        } else {
          setIsHistoryLoading(false);
        }
      }).catch(() => setIsHistoryLoading(false));
    } else {
      // Just logged out: clear state
      setMessages([]);
      setSessionId(null);
      manualLangRef.current = false;
    }
  }, [isAuthenticated]);

  // Count user messages (for signup nudge)
  const userMessageCount = messages.filter(m => m.role === 'user').length;

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen(prev => !prev), []);

  const dismissSignup = useCallback(() => setSignupDismissed(true), []);

  const sendMessage = useCallback(async (content: string, pageContext?: string) => {
    const userMsg: ChatMessage = { role: 'user', content };
    setMessages(prev => {
      const updated = [...prev, userMsg];
      saveGuestData(updated, sessionId);
      return updated;
    });
    setIsLoading(true);

    // Add placeholder for assistant response
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    let currentSessionId = sessionId;

    try {
      await sendMessageStream(content, {
        onSessionId: (id) => {
          currentSessionId = id;
          setSessionId(id);
        },
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
          // Save final state to localStorage for guests
          setMessages(prev => {
            saveGuestData(prev, currentSessionId);
            return prev;
          });
        },
        onError: (error) => {
          console.error('[Chat] stream error:', error);
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant' && last.content === '') {
              updated[updated.length - 1] = { ...last, content: '...' };
            }
            saveGuestData(updated, currentSessionId);
            return updated;
          });
          setIsLoading(false);
        },
      }, {
        sessionId: sessionId ?? undefined,
        language: chatLanguage,
        pageContext,
      });
    } catch {
      setIsLoading(false);
    }
  }, [sessionId, chatLanguage, saveGuestData]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setSignupDismissed(false);
    manualLangRef.current = false;
    localStorage.removeItem(GUEST_STORAGE_KEY);
  }, []);

  return (
    <ChatContext.Provider value={{
      messages, isOpen, isLoading, isHistoryLoading, sessionId,
      chatLanguage, setChatLanguage,
      openChat, closeChat, toggleChat, sendMessage, clearChat,
      userMessageCount, signupDismissed, dismissSignup,
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
