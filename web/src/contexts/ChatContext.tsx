import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { sendMessageStream, getSessions, getMessages, type ChatMessage, type ChatSession } from '../services/chatService';
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
  userRole: string;
  setUserRole: (role: string) => void;
  userMessageCount: number;
  signupDismissed: boolean;
  dismissSignup: () => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  sessions: ChatSession[];
  isSessionsLoading: boolean;
  loadSessions: () => Promise<void>;
  loadSession: (id: number) => Promise<void>;
  newSession: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [signupDismissed, setSignupDismissed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const { i18n } = useTranslation();
  const { isAuthenticated, isLoading: authLoading } = useUserAuth();

  // Chat language: default from i18n, can be overridden
  const [chatLanguage, setChatLanguageState] = useState(() => {
    const saved = localStorage.getItem(GUEST_LANG_KEY);
    return saved || i18n.language;
  });

  const prevAuthRef = useRef<boolean | null>(null);
  const sessionIdRef = useRef<number | null>(null);

  // Keep sessionIdRef in sync
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

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

  // Auto-save guest messages to localStorage whenever messages change
  const skipSaveRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated || skipSaveRef.current) return;
    if (messages.length === 0) return;
    // Don't save if the last message is an empty assistant placeholder (still streaming)
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant' && lastMsg.content === '') return;

    const trimmed = messages.slice(-MAX_GUEST_MESSAGES);
    const data: GuestData = {
      sessionId: sessionIdRef.current,
      messages: trimmed,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full
    }
  }, [messages, isAuthenticated]);

  // Load history helper
  const loadUserHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const sessions = await getSessions();
      if (sessions.length > 0) {
        const latest = sessions[0];
        const updatedAt = new Date(latest.updated_at).getTime();
        if (Date.now() - updatedAt < SESSION_EXPIRY_MS) {
          const msgs = await getMessages(latest.id);
          if (msgs.length > 0) {
            setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
            setSessionId(latest.id);
            if (latest.language) setChatLanguageState(latest.language);
          }
        }
      }
    } catch (err) {
      console.error('[Chat] Failed to load user history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  // Load guest history from localStorage
  const loadGuestHistory = useCallback(() => {
    try {
      const saved = localStorage.getItem(GUEST_STORAGE_KEY);
      if (saved) {
        const data: GuestData = JSON.parse(saved);
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          skipSaveRef.current = true;
          setMessages(data.messages);
          setSessionId(data.sessionId);
          // Reset skip flag after next render
          setTimeout(() => { skipSaveRef.current = false; }, 0);
        }
      }
    } catch {
      localStorage.removeItem(GUEST_STORAGE_KEY);
    }
  }, []);

  // Initialize and handle auth state changes
  // Wait for authLoading to finish before making decisions
  useEffect(() => {
    if (authLoading) return; // Wait for UserAuthProvider to finish loading

    // First time auth is resolved, or auth state changed
    if (prevAuthRef.current === null) {
      // First initialization
      prevAuthRef.current = isAuthenticated;
      if (isAuthenticated) {
        loadUserHistory();
      } else {
        loadGuestHistory();
      }
    } else if (prevAuthRef.current !== isAuthenticated) {
      // Auth state changed (login/logout)
      prevAuthRef.current = isAuthenticated;
      if (isAuthenticated) {
        // Just logged in
        localStorage.removeItem(GUEST_STORAGE_KEY);
        setMessages([]);
        setSessionId(null);
        loadUserHistory();
      } else {
        // Just logged out
        setMessages([]);
        setSessionId(null);
        manualLangRef.current = false;
      }
    }
  }, [authLoading, isAuthenticated, loadUserHistory, loadGuestHistory]);

  // Count user messages (for signup nudge)
  const userMessageCount = messages.filter(m => m.role === 'user').length;

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen(prev => !prev), []);

  const dismissSignup = useCallback(() => setSignupDismissed(true), []);

  const sendMessage = useCallback(async (content: string, pageContext?: string) => {
    const userMsg: ChatMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Add placeholder for assistant response
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      await sendMessageStream(content, {
        onSessionId: (id) => {
          sessionIdRef.current = id;
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
        sessionId: sessionIdRef.current ?? undefined,
        language: chatLanguage,
        pageContext,
        userType: userRole as 'user' | 'supplier' | 'admin',
      });
    } catch {
      setIsLoading(false);
    }
  }, [chatLanguage, userRole]);

  const loadSessions = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsSessionsLoading(true);
    try {
      const list = await getSessions();
      setSessions(list);
    } catch (err) {
      console.error('[Chat] Failed to load sessions:', err);
    } finally {
      setIsSessionsLoading(false);
    }
  }, [isAuthenticated]);

  const loadSession = useCallback(async (id: number) => {
    setIsHistoryLoading(true);
    try {
      const msgs = await getMessages(id);
      if (msgs.length > 0) {
        setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
        setSessionId(id);
        sessionIdRef.current = id;
      }
    } catch (err) {
      console.error('[Chat] Failed to load session:', err);
    } finally {
      setIsHistoryLoading(false);
      setShowHistory(false);
    }
  }, []);

  const newSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    sessionIdRef.current = null;
    setShowHistory(false);
  }, []);

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
      userRole, setUserRole,
      userMessageCount, signupDismissed, dismissSignup,
      showHistory, setShowHistory, sessions, isSessionsLoading,
      loadSessions, loadSession, newSession,
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
