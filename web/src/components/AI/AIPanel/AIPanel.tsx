import React, { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Send, Maximize2, PanelRightClose, Plus, Sparkles, X, Loader2, Paperclip, PanelRight, PanelLeft, PanelBottom, MessageCircle } from 'lucide-react';
import { useChat } from '../../../contexts/ChatContext';
import { AIPanelFeed } from './AIPanelFeed';
import { AIPanelTools, type ToolCategory } from './AIPanelTools';
import { ToolCallCard } from './ToolCallCard';
import Markdown from 'react-markdown';
import { IdentityBadge } from '../IdentityBadge';
import { compressImage, isAllowedImageType } from '../../../utils/imageCompress';
import { ShareToFeishuButton } from '../ShareToFeishuButton';
import { ShareModal, type ShareModalMessage } from '../ShareModal';
import { getMessages } from '../../../services/chatService';
import type { UserType } from '../../../services/api';
import styles from './AIPanel.module.css';
import clsx from 'clsx';

export type AIRole = 'supplier' | 'admin';
type TabKey = 'chat' | 'feed' | 'tools';
// REQ-20260509-0026: 4 种 layout 模式。'left' 定位到 sidebar 右侧
// (left: var(--app-sidebar-width)), 不与 sidebar 重叠；sidebar collapse
// 时 var 会随之变窄。'right' 是历史默认，'bottom'/'bubble' 给不同工作流。
export type LayoutMode = 'right' | 'bottom' | 'left' | 'bubble';
const LAYOUT_MODES: LayoutMode[] = ['right', 'bottom', 'left', 'bubble'];

const STORAGE_KEY = 'enjoysa_ai_panel_collapsed';
const WIDTH_STORAGE_KEY = 'enjoysa_ai_panel_width';
const layoutStorageKey = (role: AIRole) => `enjoysa_ai_panel_layout_${role}`;
const MIN_WIDTH = 300;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 380;
const BOTTOM_HEIGHT = 340;
const COLLAPSED_SIZE = 48;
const MOBILE_BREAKPOINT = '(max-width: 767px)';

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
  const location = useLocation();
  const {
    messages, isLoading, sendMessage, newSession, setUserRole, toolCalls, setDisabledTools, statusMessage,
    sessionId,
  } = useChat();

  // Share-to-Feishu state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSessionId, setShareSessionId] = useState<number>(0);
  const [shareItems, setShareItems] = useState<ShareModalMessage[]>([]);
  const [shareInitiallySelected, setShareInitiallySelected] = useState<number[]>([]);
  const [hoveredMessageIdx, setHoveredMessageIdx] = useState<number>(-1);
  const shareUserType: UserType = role === 'admin' ? 'admin' : 'supplier';

  // Open ShareModal with the latest server-side message ids loaded from API.
  // SSE-streamed bubbles do not carry ids, so we always re-fetch.
  const openShareModal = useCallback(async (mode: 'single' | 'all', anchorContent?: string) => {
    if (!sessionId) {
      return;
    }
    setShareSessionId(sessionId);
    const fetched = await getMessages(sessionId, shareUserType);
    const items: ShareModalMessage[] = fetched
      .filter(m => m.id != null)
      .map(m => ({ id: m.id as number, role: m.role, content: m.content }));
    setShareItems(items);
    if (mode === 'all') {
      setShareInitiallySelected(items.map(m => m.id));
    } else {
      // Try to anchor on the assistant message the user clicked, fallback to last assistant.
      let anchor: ShareModalMessage | undefined;
      if (anchorContent) {
        anchor = [...items].reverse().find(m => m.role === 'assistant' && m.content === anchorContent);
      }
      if (!anchor) {
        anchor = [...items].reverse().find(m => m.role === 'assistant');
      }
      setShareInitiallySelected(anchor ? [anchor.id] : []);
    }
    setShareOpen(true);
  }, [sessionId, shareUserType]);

  // Set user role for chat context
  useEffect(() => {
    setUserRole(role);
    return () => setUserRole('user');
  }, [role, setUserRole]);

  // Build page context from current route
  const getPageContext = useCallback((): string => {
    const path = location.pathname;
    const parts = path.split('/').filter(Boolean);
    // e.g. /supplier/orders/123 → ["supplier", "orders", "123"]
    const contextParts: string[] = [`当前页面: ${path}`];
    if (role === 'supplier') {
      if (parts[1] === 'orders' && parts[2]) contextParts.push(`正在查看订单 ID: ${parts[2]}`);
      else if (parts[1] === 'products' && parts[2] === 'new') contextParts.push('正在创建新商品');
      else if (parts[1] === 'products' && parts[2] && parts[3] === 'edit') contextParts.push(`正在编辑商品 ID: ${parts[2]}`);
      else if (parts[1] === 'products') contextParts.push('正在查看商品列表');
      else if (parts[1] === 'reviews') contextParts.push('正在查看评价管理');
      else if (parts[1] === 'settlement') contextParts.push('正在查看结算中心');
      else if (parts[1] === 'after-sales' && parts[2]) contextParts.push(`正在查看工单 ID: ${parts[2]}`);
      else if (parts[1] === 'after-sales') contextParts.push('正在查看售后工单');
      else if (!parts[1] || parts[1] === 'dashboard') contextParts.push('正在查看 Dashboard 总览');
    } else if (role === 'admin') {
      if (parts[1] === 'suppliers' && parts[2]) contextParts.push(`正在查看供应商 ID: ${parts[2]}`);
      else if (parts[1] === 'suppliers') contextParts.push('正在查看供应商列表');
      else if (parts[1] === 'products') contextParts.push('正在查看商品审核');
      else if (parts[1] === 'orders') contextParts.push('正在查看订单管理');
      else if (parts[1] === 'users') contextParts.push('正在查看用户管理');
      else if (parts[1] === 'finance') contextParts.push('正在查看财务管理');
      else if (!parts[1] || parts[1] === 'dashboard') contextParts.push('正在查看平台 Dashboard');
    }
    return contextParts.join('\n');
  }, [location.pathname, role]);

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
      return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(saved))) : DEFAULT_WIDTH;
    } catch { return DEFAULT_WIDTH; }
  });
  // REQ-20260509-0026: layout 偏好按角色独立持久化，supplier 和 admin 各自记住。
  const [layout, setLayoutState] = useState<LayoutMode>(() => {
    try {
      const saved = localStorage.getItem(layoutStorageKey(role));
      if (saved === 'right' || saved === 'left' || saved === 'bottom' || saved === 'bubble') return saved;
    } catch { /* */ }
    return 'right';
  });
  // 移动端强制 bubble，不污染 desktop 偏好（mq listener 切回 desktop 时恢复保存值）。
  const [isMobile, setIsMobile] = useState(() => {
    try { return window.matchMedia(MOBILE_BREAKPOINT).matches; } catch { return false; }
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_BREAKPOINT);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const effectiveLayout: LayoutMode = isMobile ? 'bubble' : layout;
  const setLayout = useCallback((next: LayoutMode) => {
    setLayoutState(next);
    try { localStorage.setItem(layoutStorageKey(role), next); } catch { /* */ }
  }, [role]);
  const [activeTab, setActiveTab] = useState<TabKey>('chat');
  const [input, setInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) uploadImage(file);
    }
    // Reset so picking the same file again still triggers onChange.
    e.target.value = '';
  }, []);

  // Resize handler. left 模式 handle 在右侧（拖右 = 加宽）；right 模式相反。
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = panelWidth;
    const isLeftDock = layout === 'left' && !isMobile;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = isLeftDock ? (ev.clientX - startX) : (startX - ev.clientX);
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Save final width
      try { localStorage.setItem(WIDTH_STORAGE_KEY, String(panelWidth)); } catch { /* */ }
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth, layout, isMobile]);

  // REQ-20260509-0026: 3 个 CSS var 对应 right/left/bottom dock layout，
  // 把 panel 当前占用尺寸暴露给 AdminLayout/SupplierLayout 的 main 内容做让位。
  // bubble layout 不参与让位（浮动元素），三个 var 都写 0px。
  // left 模式下 panel 通过 CSS `left: var(--app-sidebar-width)` 紧贴 sidebar 右侧。
  useEffect(() => {
    const root = document.documentElement;
    const width = collapsed ? COLLAPSED_SIZE : panelWidth;
    const height = collapsed ? COLLAPSED_SIZE : BOTTOM_HEIGHT;
    root.style.setProperty('--ai-panel-width', effectiveLayout === 'right' ? `${width}px` : '0px');
    root.style.setProperty('--ai-panel-left-width', effectiveLayout === 'left' ? `${width}px` : '0px');
    root.style.setProperty('--ai-panel-bottom-height', effectiveLayout === 'bottom' ? `${height}px` : '0px');
    if (!isResizing) {
      try { localStorage.setItem(WIDTH_STORAGE_KEY, String(panelWidth)); } catch { /* */ }
    }
    return () => {
      root.style.removeProperty('--ai-panel-width');
      root.style.removeProperty('--ai-panel-left-width');
      root.style.removeProperty('--ai-panel-bottom-height');
    };
  }, [effectiveLayout, panelWidth, collapsed, isResizing]);

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

  // Image paste/upload state (must be before handleSend)
  const [pastedImages, setPastedImages] = useState<{ file: File; preview: string; url?: string; uploading: boolean }[]>([]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    const hasImages = pastedImages.some(img => img.url);
    if ((!trimmed && !hasImages) || isLoading) return;

    // FIX #7: Don't duplicate image URLs in pageContext — only pass via imageUrls param
    const context = getPageContext();
    const imageUrls = pastedImages.filter(img => img.url).map(img => img.url!);

    // REQ-20260505-0036: embed image URLs as markdown into the persisted
    // message body so the user bubble can render them and they survive a
    // page reload from history. imageUrls is still passed separately to
    // keep the GLM vision pipeline working.
    const imageMd = imageUrls.map(u => `![image](${u})`).join('\n');
    const message = trimmed
      ? (imageMd ? `${trimmed}\n\n${imageMd}` : trimmed)
      : imageMd;
    if (!message) return;
    setInput('');
    // FIX #6: Release ObjectURLs before clearing
    pastedImages.forEach(img => URL.revokeObjectURL(img.preview));
    setPastedImages([]);
    sendMessage(message, context, imageUrls.length > 0 ? imageUrls : undefined);
  }, [input, isLoading, sendMessage, getPageContext, pastedImages]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isComposing]);

  const handleCompositionStart = useCallback(() => setIsComposing(true), []);
  const handleCompositionEnd = useCallback(() => setIsComposing(false), []);

  // FIX #5: Use ref to track image count for concurrent paste safety
  const imageCountRef = useRef(0);
  useEffect(() => { imageCountRef.current = pastedImages.length; }, [pastedImages.length]);

  // Image paste/upload
  const uploadImage = useCallback(async (file: File) => {
    // FIX #5: Check limit via ref (not stale closure)
    if (imageCountRef.current >= 9) {
      alert(t('aiPanel.maxImages', '最多上传 9 张图片'));
      return;
    }
    imageCountRef.current++;

    // Validate type
    if (!isAllowedImageType(file)) {
      alert(t('aiPanel.invalidImageType', '仅支持 JPG/PNG/WebP 格式'));
      imageCountRef.current--;
      return;
    }

    // Compress if needed
    const compressed = await compressImage(file);
    const preview = URL.createObjectURL(compressed);
    setPastedImages(prev => [...prev, { file: compressed, preview, uploading: true }]);

    try {
      const formData = new FormData();
      formData.append('file', compressed);
      const token = localStorage.getItem('enjoysa_supplier_token') || localStorage.getItem('enjoysa_admin_token') || '';
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // Try ai-proj COS upload first, fallback to local
      let uploadUrl = '';
      const cosResp = await fetch('/api/v1/ai/upload-image', { method: 'POST', headers, body: formData });
      const cosJson = await cosResp.json();
      if (cosJson.success && cosJson.data?.url) {
        uploadUrl = cosJson.data.url;
      } else {
        // Fallback to local upload
        const localForm = new FormData();
        localForm.append('file', compressed);
        const localResp = await fetch('/api/v1/upload', { method: 'POST', headers, body: localForm });
        const localJson = await localResp.json();
        if (localJson.success && localJson.data?.url) {
          uploadUrl = localJson.data.url;
        }
      }

      if (uploadUrl) {
        setPastedImages(prev => prev.map(img =>
          img.preview === preview ? { ...img, url: uploadUrl, uploading: false } : img
        ));
      } else {
        setPastedImages(prev => prev.filter(img => img.preview !== preview));
        imageCountRef.current = Math.max(0, imageCountRef.current - 1);
        alert(t('aiPanel.uploadFailed', '图片上传失败，请重试'));
      }
    } catch {
      setPastedImages(prev => prev.filter(img => img.preview !== preview));
      imageCountRef.current = Math.max(0, imageCountRef.current - 1);
      alert(t('aiPanel.uploadFailed', '图片上传失败，请重试'));
    }
  }, [t]);

  // FIX #8: Handle ALL image items in clipboard, not just the first
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    let hasImage = false;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        if (!hasImage) { e.preventDefault(); hasImage = true; }
        const file = item.getAsFile();
        if (file) uploadImage(file);
      }
    }
  }, [uploadImage]);

  const removeImage = useCallback((preview: string) => {
    setPastedImages(prev => prev.filter(img => img.preview !== preview));
    URL.revokeObjectURL(preview);
  }, []);

  const handleToolClick = useCallback((path?: string) => {
    if (path) navigate(path);
  }, [navigate]);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'chat', label: t('aiPanel.tab.chat', '对话'), icon: '💬' },
    { key: 'feed', label: t('aiPanel.tab.feed', '动态'), icon: '⚡' },
    { key: 'tools', label: t('aiPanel.tab.tools', '工具'), icon: '🔧' },
  ];

  return (
    <div
      className={clsx(
        styles.panel,
        styles[effectiveLayout],
        collapsed && styles.collapsed,
      )}
      style={
        // 仅 right/left dock 模式下 inline width 由用户拖拽控制；
        // bottom 模式宽度=100vw、bubble 模式尺寸固定，都让 CSS 接管。
        collapsed || effectiveLayout === 'bottom' || effectiveLayout === 'bubble'
          ? undefined
          : { width: panelWidth }
      }
    >
      {/* Resize handle: only meaningful for right/left dock and when not collapsed */}
      {!collapsed && (effectiveLayout === 'right' || effectiveLayout === 'left') && (
        <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />
      )}
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
            {/* REQ-20260509-0026: layout 切换器，移动端 disabled（自动 bubble） */}
            <div className={styles.layoutSwitcher} role="group" aria-label={t('aiPanel.layoutSwitcher', '面板布局') as string}>
              {LAYOUT_MODES.map(mode => {
                const Icon = mode === 'right' ? PanelRight
                  : mode === 'left' ? PanelLeft
                    : mode === 'bottom' ? PanelBottom
                      : MessageCircle;
                const label = mode === 'right' ? t('aiPanel.layout.right', '右侧')
                  : mode === 'left' ? t('aiPanel.layout.left', '左侧')
                    : mode === 'bottom' ? t('aiPanel.layout.bottom', '底部')
                      : t('aiPanel.layout.bubble', '气泡');
                return (
                  <button
                    key={mode}
                    type="button"
                    className={clsx(styles.layoutBtn, effectiveLayout === mode && styles.active)}
                    onClick={() => setLayout(mode)}
                    disabled={isMobile}
                    aria-pressed={effectiveLayout === mode}
                    title={label as string}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>
            {activeTab === 'chat' && (
              <button className={styles.actionBtn} onClick={newSession} title={t('aiPanel.newChat', '新对话')}>
                <Plus size={16} />
              </button>
            )}
            <button
              className={styles.actionBtn}
              onClick={() => navigate(role === 'supplier' ? '/supplier/chat' : '/admin/ai-chat')}
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
                    <div
                      key={i}
                      className={clsx(styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant)}
                      onMouseEnter={() => setHoveredMessageIdx(i)}
                      onMouseLeave={() => setHoveredMessageIdx(idx => (idx === i ? -1 : idx))}
                    >
                      <div className={styles.bubbleLabel}>
                        {msg.role === 'user' ? t('aiPanel.you', '您') : t('aiPanel.brand', '畅游南澳AI')}
                        {msg.role === 'assistant' && msg.content && sessionId && (
                          <span className={styles.bubbleActions}>
                            <ShareToFeishuButton
                              visible={hoveredMessageIdx === i}
                              onClick={() => openShareModal('single', msg.content)}
                            />
                          </span>
                        )}
                      </div>
                      <div className={clsx(styles.bubbleContent, styles.markdown)}>
                        {msg.content ? (
                          <Markdown>{msg.content}</Markdown>
                        ) : (isLoading && i === messages.length - 1 ? (
                          <div className={styles.typing}>
                            {statusMessage ? (
                              <span>{statusMessage}</span>
                            ) : (
                              <><span className={styles.typingDot} /><span className={styles.typingDot} /><span className={styles.typingDot} /></>
                            )}
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
            <div className={styles.chatIdentityRow}>
              <IdentityBadge role={role} />
              {messages.length > 0 && sessionId && (
                <button
                  type="button"
                  className={styles.shareSessionBtn}
                  onClick={() => openShareModal('all')}
                  title={t('aiPanel.share.shareSession', { defaultValue: '分享整个会话到飞书' }) as string}
                >
                  📤 {t('aiPanel.share.shareSession', { defaultValue: '分享整会话' })}
                </button>
              )}
            </div>
            <div className={styles.chatInput}>
              {pastedImages.length > 0 && (
                <div className={styles.imagePreviewRow}>
                  {pastedImages.map(img => (
                    <div key={img.preview} className={styles.imagePreview}>
                      <img src={img.preview} alt="preview" />
                      {img.uploading && <div className={styles.imageUploading}><Loader2 size={14} className={styles.spin} /></div>}
                      <button className={styles.imageRemove} onClick={() => removeImage(img.preview)}><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleFilePick}
              />
              <button
                type="button"
                className={styles.chatAttachBtn}
                onClick={() => fileInputRef.current?.click()}
                title={t('aiPanel.attachImage', { defaultValue: '上传图片' }) as string}
                aria-label={t('aiPanel.attachImage', { defaultValue: '上传图片' }) as string}
              >
                <Paperclip size={14} />
              </button>
              <textarea
                ref={textareaRef}
                className={styles.chatTextarea}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder={pastedImages.length > 0 ? t('aiPanel.describeScreenshot', '描述截图内容...') : t('aiPanel.inputPlaceholder', '输入消息...')}
                rows={1}
              />
              <button
                className={styles.chatExpandBtn}
                onClick={() => navigate(role === 'supplier' ? '/supplier/chat' : '/admin/ai-chat')}
                title={t('aiPanel.fullscreen', '全屏对话')}
              >
                <Maximize2 size={14} />
              </button>
              <button
                className={styles.chatSendBtn}
                onClick={handleSend}
                disabled={(!input.trim() && pastedImages.length === 0) || isLoading}
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
              onDisabledToolsChange={setDisabledTools}
            />
          </div>
        </div>
      </div>
      <ShareModal
        open={shareOpen}
        sessionId={shareSessionId}
        messages={shareItems}
        initiallySelectedIds={shareInitiallySelected}
        userType={shareUserType}
        onClose={() => setShareOpen(false)}
        onSuccess={() => setShareOpen(false)}
      />
    </div>
  );
};

export default AIPanel;
