package handler

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	chatmodel "enjoysa-backend/internal/chat/model"
	"enjoysa-backend/internal/chat/service"
	"enjoysa-backend/internal/chat/store"
	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/models"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type ChatHandler struct {
	store     *store.ChatStore
	aiService *service.AIService
}

func NewChatHandler(s *store.ChatStore, ai *service.AIService) *ChatHandler {
	return &ChatHandler{store: s, aiService: ai}
}

type SendMessageRequest struct {
	SessionID   uint   `json:"session_id"`
	Message     string `json:"message" binding:"required,max=4000"`
	Language    string `json:"language"`
	PageContext string `json:"page_context" binding:"max=2000"`
}

// SendMessageStream handles POST /chat/send with SSE streaming response.
func (h *ChatHandler) SendMessageStream(c *gin.Context) {
	var req SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Determine user identity
	userID := uint(0)
	userType := "guest"
	if u, exists := c.Get("user"); exists {
		user := u.(*models.User)
		userID = user.ID
		userType = "user"
	}

	lang := req.Language
	if lang == "" {
		lang = "en"
	}

	// Get or create session
	var session *chatmodel.ChatSession
	if req.SessionID > 0 {
		var err error
		session, err = h.store.GetSession(req.SessionID)
		if err != nil || (userType == "user" && session.UserID != userID) {
			response.NotFound(c, "Session not found")
			return
		}
	} else {
		session = &chatmodel.ChatSession{
			UserID:   userID,
			UserType: userType,
			Language: lang,
			Context:  req.PageContext,
		}
		if err := h.store.CreateSession(session); err != nil {
			response.ServerError(c, "Failed to create session")
			return
		}
	}

	// Save user message
	userMsg := &chatmodel.ChatMessage{
		SessionID: session.ID,
		Role:      "user",
		Content:   req.Message,
	}
	if err := h.store.CreateMessage(userMsg); err != nil {
		response.ServerError(c, "Failed to save message")
		return
	}

	// Build message history for AI
	recentMsgs, err := h.store.GetRecentMessages(session.ID, 20)
	if err != nil {
		response.ServerError(c, "Failed to load history")
		return
	}

	aiMessages := []service.Message{
		{Role: "system", Content: service.SystemPrompt(lang, req.PageContext)},
	}
	for _, m := range recentMsgs {
		aiMessages = append(aiMessages, service.Message{Role: m.Role, Content: m.Content})
	}

	// Set SSE headers
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	// Send session_id as first event
	fmt.Fprintf(c.Writer, "data: {\"type\":\"session\",\"session_id\":%d}\n\n", session.ID)
	c.Writer.Flush()

	// Stream AI response
	var fullResponse strings.Builder
	streamErr := h.aiService.ChatStream(c.Request.Context(), aiMessages, func(chunk string) bool {
		fullResponse.WriteString(chunk)
		// JSON-escape the chunk content
		escaped, _ := json.Marshal(chunk)
		fmt.Fprintf(c.Writer, "data: {\"type\":\"token\",\"content\":%s}\n\n", string(escaped))
		c.Writer.Flush()
		return true
	})

	if streamErr != nil {
		logger.Errorf("[Chat] stream error: %v", streamErr)
		fmt.Fprintf(c.Writer, "data: {\"type\":\"error\",\"content\":\"AI service temporarily unavailable\"}\n\n")
		c.Writer.Flush()
		return
	}

	// Save assistant response
	assistantMsg := &chatmodel.ChatMessage{
		SessionID: session.ID,
		Role:      "assistant",
		Content:   fullResponse.String(),
	}
	_ = h.store.CreateMessage(assistantMsg)

	// Auto-generate title from first message
	if session.Title == "" {
		runes := []rune(req.Message)
		title := string(runes)
		if len(runes) > 50 {
			title = string(runes[:50]) + "..."
		}
		_ = h.store.UpdateSessionTitle(session.ID, title)
	}

	// Send done event
	fmt.Fprintf(c.Writer, "data: {\"type\":\"done\"}\n\n")
	c.Writer.Flush()
}

// ListSessions returns user's chat sessions.
func (h *ChatHandler) ListSessions(c *gin.Context) {
	userID := uint(0)
	userType := "guest"
	if u, exists := c.Get("user"); exists {
		user := u.(*models.User)
		userID = user.ID
		userType = "user"
	}

	sessions, err := h.store.ListSessions(userID, userType, 20)
	if err != nil {
		response.ServerError(c, "Failed to list sessions")
		return
	}

	response.Success(c, sessions)
}

// GetMessages returns messages for a session.
func (h *ChatHandler) GetMessages(c *gin.Context) {
	sessionID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid session ID")
		return
	}

	session, err := h.store.GetSession(uint(sessionID))
	if err != nil {
		response.NotFound(c, "Session not found")
		return
	}

	// Verify ownership
	if u, exists := c.Get("user"); exists {
		user := u.(*models.User)
		if session.UserID != user.ID {
			response.NotFound(c, "Session not found")
			return
		}
	}

	messages, err := h.store.ListMessages(uint(sessionID))
	if err != nil {
		response.ServerError(c, "Failed to load messages")
		return
	}

	response.Success(c, messages)
}
