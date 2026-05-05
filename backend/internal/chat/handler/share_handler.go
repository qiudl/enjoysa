package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	aichatmodel "enjoysa-backend/internal/aichat/model"
	aichatstore "enjoysa-backend/internal/aichat/store"
	chatmodel "enjoysa-backend/internal/chat/model"
	"enjoysa-backend/internal/chat/store"
	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/integration/feishu"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

// ShareHandler exposes POST /chat/share + GET /supplier/chat/shares.
type ShareHandler struct {
	chatStore   *store.ChatStore
	shareStore  *store.ShareStore
	kbStore     *aichatstore.KnowledgeStore
	feishu      *feishu.Client
	frontendURL string

	limiter *userRateLimiter
}

func NewShareHandler(cs *store.ChatStore, ss *store.ShareStore, kbs *aichatstore.KnowledgeStore, fc *feishu.Client, frontendURL string) *ShareHandler {
	return &ShareHandler{
		chatStore:   cs,
		shareStore:  ss,
		kbStore:     kbs,
		feishu:      fc,
		frontendURL: strings.TrimRight(frontendURL, "/"),
		limiter:     newUserRateLimiter(10, time.Minute),
	}
}

// ShareRequest is the inbound payload for POST /chat/share.
type ShareRequest struct {
	SessionID            uint   `json:"session_id" binding:"required"`
	MessageIDs           []uint `json:"message_ids" binding:"required,min=1"`
	Note                 string `json:"note" binding:"max=500"`
	AddToKnowledgeBase   bool   `json:"add_to_knowledge_base"`
}

// ShareResponse is returned to the caller; success may be false even on 200
// when the local share record was written but the Feishu post failed — the
// frontend uses error_message to drive its retry UI.
type ShareResponse struct {
	ShareID         uint   `json:"share_id"`
	Success         bool   `json:"success"`
	FeishuMessageID string `json:"feishu_message_id,omitempty"`
	ErrorMessage    string `json:"error_message,omitempty"`
	AddedToKB       bool   `json:"added_to_kb"`
}

// Send handles POST /api/v1/chat/share.
func (h *ShareHandler) Send(c *gin.Context) {
	chatUser := buildChatUser(c)
	if chatUser.IsGuest() {
		response.Unauthorized(c, "Sign in to share")
		return
	}

	if !h.limiter.Allow(chatUser.UserType, chatUser.UserID) {
		c.JSON(429, gin.H{"success": false, "error": "Too many shares, slow down"})
		return
	}

	var req ShareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if h.feishu == nil {
		c.JSON(503, gin.H{"success": false, "error": "Feishu webhook is not configured"})
		return
	}

	// Session ownership check.
	session, err := h.chatStore.GetSession(req.SessionID)
	if err != nil || session == nil || session.UserID != chatUser.UserID || session.UserType != chatUser.UserType {
		response.NotFound(c, "Session not found")
		return
	}

	// Load messages once and project to the requested ids preserving order.
	allMessages, err := h.chatStore.ListMessages(req.SessionID)
	if err != nil {
		response.ServerError(c, "Failed to load messages")
		return
	}
	idSet := make(map[uint]bool, len(req.MessageIDs))
	for _, id := range req.MessageIDs {
		idSet[id] = true
	}
	picked := make([]chatmodel.ChatMessage, 0, len(req.MessageIDs))
	for _, m := range allMessages {
		if idSet[m.ID] {
			picked = append(picked, m)
		}
	}
	if len(picked) == 0 {
		response.BadRequest(c, "No matching messages in session")
		return
	}

	// Persist the share record up front so we always have a row to update.
	share := &chatmodel.ChatMessageShare{
		SessionID:  req.SessionID,
		UserID:     chatUser.UserID,
		UserType:   chatUser.UserType,
		SupplierID: chatUser.SupplierID,
		MessageIDs: marshalIDs(req.MessageIDs),
		Note:       req.Note,
		Channel:    "feishu",
	}
	if err := h.shareStore.Create(share); err != nil {
		response.ServerError(c, "Failed to record share")
		return
	}

	card := h.buildCard(chatUser, session, picked, req.Note)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()
	msgID, sendErr := h.feishu.SendCard(ctx, card)

	if sendErr != nil {
		share.Success = false
		share.ErrorMessage = truncateErr(sendErr)
		_ = h.shareStore.Update(share)
		logger.Errorf("[Share] feishu send failed share=%d: %v", share.ID, sendErr)
		response.Success(c, ShareResponse{
			ShareID:      share.ID,
			Success:      false,
			ErrorMessage: share.ErrorMessage,
		})
		return
	}

	share.Success = true
	share.FeishuMsgID = msgID

	// Knowledge base backfill — admin-only, server enforced.
	if req.AddToKnowledgeBase && chatUser.UserType == "admin" && h.kbStore != nil {
		title := buildKBTitle(picked)
		content := buildKBContent(picked, req.Note)
		shareID := share.ID
		entry := &aichatstore.KnowledgeEntry{
			Category: "share",
			Title:    title,
			Content:  content,
			Audience: "all",
			Source:   "ai-chat-share",
			SourceID: &shareID,
			Author:   chatUser.Name,
		}
		if kbID, kbErr := h.kbStore.Create(entry); kbErr == nil {
			share.AddedToKB = true
			share.KBKnowledgeID = &kbID
		} else {
			logger.Errorf("[Share] kb create failed share=%d: %v", share.ID, kbErr)
		}
	}

	_ = h.shareStore.Update(share)

	response.Success(c, ShareResponse{
		ShareID:         share.ID,
		Success:         true,
		FeishuMessageID: msgID,
		AddedToKB:       share.AddedToKB,
	})
}

// ListMine handles GET /api/v1/supplier/chat/shares (and friends).
// For supplier callers it returns the supplier-wide history; for admin it
// returns the admin's own history.
func (h *ShareHandler) ListMine(c *gin.Context) {
	chatUser := buildChatUser(c)
	if chatUser.IsGuest() {
		response.Unauthorized(c, "Sign in")
		return
	}

	page := atoiDefault(c.Query("page"), 1)
	pageSize := atoiDefault(c.Query("page_size"), 20)

	var (
		items []chatmodel.ChatMessageShare
		total int64
		err   error
	)
	if chatUser.UserType == "supplier" && chatUser.SupplierID != nil {
		items, total, err = h.shareStore.ListBySupplier(*chatUser.SupplierID, page, pageSize)
	} else {
		items, total, err = h.shareStore.ListByUser(chatUser.UserID, chatUser.UserType, page, pageSize)
	}
	if err != nil {
		response.ServerError(c, "Failed to load shares")
		return
	}

	response.Success(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// --- helpers ---

func (h *ShareHandler) buildCard(user *aichatmodel.ChatUser, session *chatmodel.ChatSession, msgs []chatmodel.ChatMessage, note string) feishu.InteractiveCard {
	question, answer := pickQA(msgs)
	sender := buildSenderLabel(user)
	detailURL := h.buildDetailURL(user, session, msgs)
	return feishu.InteractiveCard{
		Title:     "📤 EnjoySA AI 分享",
		Question:  question,
		Answer:    answer,
		Sender:    sender,
		Timestamp: time.Now(),
		DetailURL: detailURL,
		Note:      note,
	}
}

func (h *ShareHandler) buildDetailURL(user *aichatmodel.ChatUser, session *chatmodel.ChatSession, msgs []chatmodel.ChatMessage) string {
	if h.frontendURL == "" {
		return ""
	}
	role := "supplier"
	switch user.UserType {
	case "admin":
		role = "admin"
	case "user":
		role = ""
	}
	anchor := ""
	if len(msgs) > 0 {
		anchor = fmt.Sprintf("#m%d", msgs[0].ID)
	}
	if role == "" {
		return fmt.Sprintf("%s/ai-chat/sessions/%d%s", h.frontendURL, session.ID, anchor)
	}
	return fmt.Sprintf("%s/%s/ai-chat/sessions/%d%s", h.frontendURL, role, session.ID, anchor)
}

func pickQA(msgs []chatmodel.ChatMessage) (string, string) {
	var q, a string
	for _, m := range msgs {
		switch m.Role {
		case "user":
			if q == "" {
				q = m.Content
			}
		case "assistant":
			if a == "" {
				a = m.Content
			} else {
				a += "\n\n" + m.Content
			}
		}
	}
	if q == "" {
		q = "(无显式问题)"
	}
	if a == "" {
		a = "(本次仅分享了用户消息，未含 AI 答复)"
	}
	return q, a
}

func buildSenderLabel(user *aichatmodel.ChatUser) string {
	switch user.UserType {
	case "supplier":
		if user.SupplierName != "" {
			return fmt.Sprintf("%s（供应商 · %s）", user.Name, user.SupplierName)
		}
		return fmt.Sprintf("%s（供应商）", user.Name)
	case "admin":
		return fmt.Sprintf("%s（平台管理员）", user.Name)
	case "user":
		return fmt.Sprintf("%s（用户）", user.Name)
	default:
		return "匿名访客"
	}
}

func buildKBTitle(msgs []chatmodel.ChatMessage) string {
	for _, m := range msgs {
		if m.Role == "user" {
			r := []rune(strings.TrimSpace(m.Content))
			if len(r) > 60 {
				return string(r[:60]) + "..."
			}
			return string(r)
		}
	}
	return "AI 分享"
}

func buildKBContent(msgs []chatmodel.ChatMessage, note string) string {
	var sb strings.Builder
	for _, m := range msgs {
		switch m.Role {
		case "user":
			sb.WriteString("Q: ")
		case "assistant":
			sb.WriteString("A: ")
		default:
			sb.WriteString(m.Role + ": ")
		}
		sb.WriteString(strings.TrimSpace(m.Content))
		sb.WriteString("\n\n")
	}
	if note != "" {
		sb.WriteString("📝 ")
		sb.WriteString(note)
	}
	return sb.String()
}

func marshalIDs(ids []uint) string {
	b, _ := json.Marshal(ids)
	return string(b)
}

func truncateErr(err error) string {
	s := err.Error()
	if len(s) > 500 {
		return s[:500]
	}
	return s
}

func atoiDefault(s string, def int) int {
	var n int
	if _, err := fmt.Sscanf(s, "%d", &n); err != nil || n <= 0 {
		return def
	}
	return n
}

// --- per-user rate limiter ---

type userRateLimiter struct {
	mu       sync.Mutex
	hits     map[string][]time.Time
	limit    int
	window   time.Duration
}

func newUserRateLimiter(limit int, window time.Duration) *userRateLimiter {
	return &userRateLimiter{
		hits:   make(map[string][]time.Time),
		limit:  limit,
		window: window,
	}
}

func (r *userRateLimiter) Allow(userType string, userID uint) bool {
	if userID == 0 {
		return true
	}
	key := fmt.Sprintf("%s:%d", userType, userID)
	now := time.Now()
	cutoff := now.Add(-r.window)

	r.mu.Lock()
	defer r.mu.Unlock()

	prev := r.hits[key]
	kept := prev[:0]
	for _, t := range prev {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= r.limit {
		r.hits[key] = kept
		return false
	}
	kept = append(kept, now)
	r.hits[key] = kept
	return true
}

