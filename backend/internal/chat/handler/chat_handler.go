package handler

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	aichatmodel "enjoysa-backend/internal/aichat/model"
	aichatservice "enjoysa-backend/internal/aichat/service"
	authmodel "enjoysa-backend/internal/auth/model"
	chatmodel "enjoysa-backend/internal/chat/model"
	"enjoysa-backend/internal/chat/service"
	"enjoysa-backend/internal/chat/store"
	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/models"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ChatHandler struct {
	store        *store.ChatStore
	aiService    *service.AIService
	llmClient    *aichatservice.LLMClient
	toolRegistry *aichatservice.ToolRegistry
	glmClient    *aichatservice.GLMClient
	db           *gorm.DB
}

func NewChatHandler(s *store.ChatStore, ai *service.AIService) *ChatHandler {
	return &ChatHandler{store: s, aiService: ai}
}

// SetToolSupport enables tool calling for supplier/admin chat.
func (h *ChatHandler) SetToolSupport(llm *aichatservice.LLMClient, registry *aichatservice.ToolRegistry, db *gorm.DB) {
	h.llmClient = llm
	h.toolRegistry = registry
	h.db = db
}

// SetGLMClient enables image recognition via GLM-4V.
func (h *ChatHandler) SetGLMClient(glm *aichatservice.GLMClient) {
	h.glmClient = glm
}

type SendMessageRequest struct {
	SessionID     uint     `json:"session_id"`
	Message       string   `json:"message" binding:"required,max=4000"`
	Language      string   `json:"language"`
	PageContext   string   `json:"page_context" binding:"max=2000"`
	UserType      string   `json:"user_type"`
	DisabledTools []string `json:"disabled_tools"`
	ImageURLs     []string `json:"image_urls"`
}

// buildChatUser resolves the ChatUser from the gin context populated by the
// auth middleware. Order matters: supplier_user takes precedence over user
// because the supplier middleware always sets a richer object.
func buildChatUser(c *gin.Context) *aichatmodel.ChatUser {
	if v, ok := c.Get("supplier_user"); ok {
		if su, ok := v.(*models.SupplierUser); ok && su != nil {
			supplierName := ""
			if su.Supplier != nil {
				supplierName = su.Supplier.Name
			}
			supplierID := su.SupplierID
			return &aichatmodel.ChatUser{
				UserType:     "supplier",
				UserID:       su.ID,
				Name:         su.Name,
				Role:         su.Role,
				SupplierID:   &supplierID,
				SupplierName: supplierName,
			}
		}
	}
	if v, ok := c.Get("admin"); ok {
		if a, ok := v.(*authmodel.Admin); ok && a != nil {
			role := a.Role
			if r, ok := c.Get("admin_role"); ok {
				if rs, ok := r.(string); ok && rs != "" {
					role = rs
				}
			}
			return &aichatmodel.ChatUser{
				UserType: "admin",
				UserID:   a.ID,
				Name:     a.Name,
				Role:     role,
			}
		}
	}
	if v, ok := c.Get("user"); ok {
		if u, ok := v.(*models.User); ok && u != nil {
			return &aichatmodel.ChatUser{
				UserType: "user",
				UserID:   u.ID,
				Name:     u.Name,
			}
		}
	}
	return &aichatmodel.ChatUser{UserType: "guest"}
}

// SendMessageStream handles POST /chat/send with SSE streaming response.
func (h *ChatHandler) SendMessageStream(c *gin.Context) {
	var req SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Determine user identity from authenticated context (single source of truth).
	chatUser := buildChatUser(c)
	userID := chatUser.UserID
	userType := chatUser.UserType

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

	// FIX #3: Save original user message (without GLM enrichment) to history
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
		{Role: "system", Content: service.SystemPrompt(lang, req.PageContext, chatUser)},
	}
	for _, m := range recentMsgs {
		aiMessages = append(aiMessages, service.Message{Role: m.Role, Content: m.Content})
	}

	// FIX #1: Set SSE headers BEFORE GLM recognition so frontend gets immediate response
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	// Send session_id as first event
	fmt.Fprintf(c.Writer, "data: {\"type\":\"session\",\"session_id\":%d}\n\n", session.ID)
	c.Writer.Flush()

	// FIX #1 + #2: GLM vision recognition AFTER SSE is established
	if len(req.ImageURLs) > 0 && h.glmClient != nil {
		// FIX #13: Use "status" event type (not "token") to avoid polluting assistant message
		fmt.Fprintf(c.Writer, "data: {\"type\":\"status\",\"content\":\"正在识别图片...\"}\n\n")
		c.Writer.Flush()

		// FIX #2 + #14: Ensure URLs are absolute for GLM to download (derive from request Host)
		scheme := "https"
		host := c.Request.Host
		if host == "" {
			host = "enjoysau.com"
		}
		absoluteURLs := make([]string, 0, len(req.ImageURLs))
		for _, u := range req.ImageURLs {
			if strings.HasPrefix(u, "/") {
				u = scheme + "://" + host + u
			}
			absoluteURLs = append(absoluteURLs, u)
		}

		description, glmErr := h.glmClient.DescribeImages(c.Request.Context(), absoluteURLs, req.Message)
		if glmErr != nil {
			logger.Warn("[Chat] GLM image recognition failed: %v", glmErr)
			// Inject degradation notice into the last user message for AI
			aiMessages[len(aiMessages)-1].Content += "\n\n[用户上传了图片但识别失败，请基于文字回复]"
		} else {
			// Inject GLM description into the last user message for AI (not stored in DB)
			aiMessages[len(aiMessages)-1].Content += "\n\n[AI 图片识别结果: " + description + "]"
		}
		// Append image URLs for AI reference
		for _, url := range req.ImageURLs {
			aiMessages[len(aiMessages)-1].Content += "\n![图片](" + url + ")"
		}
	}

	// Use tool-calling flow for supplier/admin if LLM client is available
	if (userType == "supplier" || userType == "admin") && h.llmClient != nil && h.toolRegistry != nil {
		h.streamWithTools(c, session, aiMessages, lang, chatUser, req.Message, req.DisabledTools)
		return
	}

	// Simple stream for guests/users (no tool calling)
	var fullResponse strings.Builder
	streamErr := h.aiService.ChatStream(c.Request.Context(), aiMessages, func(chunk string) bool {
		fullResponse.WriteString(chunk)
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

	h.finishStream(c, session, fullResponse.String(), req.Message)
}

// finishStream saves the response and sends the done event.
func (h *ChatHandler) finishStream(c *gin.Context, session *chatmodel.ChatSession, content, userMessage string) {
	assistantMsg := &chatmodel.ChatMessage{
		SessionID: session.ID,
		Role:      "assistant",
		Content:   content,
	}
	_ = h.store.CreateMessage(assistantMsg)

	if session.Title == "" {
		runes := []rune(userMessage)
		title := string(runes)
		if len(runes) > 50 {
			title = string(runes[:50]) + "..."
		}
		_ = h.store.UpdateSessionTitle(session.ID, title)
	}

	fmt.Fprintf(c.Writer, "data: {\"type\":\"done\"}\n\n")
	c.Writer.Flush()
}

// streamWithTools handles the tool-calling chat flow for supplier/admin.
func (h *ChatHandler) streamWithTools(c *gin.Context, session *chatmodel.ChatSession, sysMessages []service.Message, lang string, chatUser *aichatmodel.ChatUser, userMessage string, disabledTools []string) {
	ctx := c.Request.Context()
	userType := chatUser.UserType

	// Build LLM messages from service.Message
	llmMessages := make([]aichatservice.ChatMessage, len(sysMessages))
	for i, m := range sysMessages {
		llmMessages[i] = aichatservice.ChatMessage{Role: m.Role, Content: m.Content}
	}

	// Get tools
	allTools := h.toolRegistry.GetOpenAITools(true, userType)
	// Filter out disabled tools
	disabledSet := make(map[string]bool, len(disabledTools))
	for _, name := range disabledTools {
		disabledSet[name] = true
	}
	var tools []aichatmodel.OpenAITool
	for _, t := range allTools {
		if !disabledSet[t.Function.Name] {
			tools = append(tools, t)
		}
	}

	// Tool context: identity comes from the resolved ChatUser. For suppliers
	// the legacy UserID slot carries supplier_id (existing tools rely on this);
	// the new User field exposes the full identity for new tools.
	toolUserID := chatUser.UserID
	if chatUser.UserType == "supplier" && chatUser.SupplierID != nil {
		toolUserID = *chatUser.SupplierID
	}
	toolCtx := aichatmodel.ToolContext{
		User:     chatUser,
		UserID:   &toolUserID,
		Language: lang,
		DB:       h.db,
	}

	var fullResponse strings.Builder
	maxRounds := 3 // prevent infinite tool loops

	for round := 0; round <= maxRounds; round++ {
		var pendingToolCalls []aichatmodel.OpenAIToolCall
		var contentBuf strings.Builder

		err := h.llmClient.ChatStreamFunc(ctx, llmMessages, tools, func(event aichatservice.StreamEvent) {
			switch event.Type {
			case "content":
				contentBuf.WriteString(event.Content)
				fullResponse.WriteString(event.Content)
				escaped, _ := json.Marshal(event.Content)
				fmt.Fprintf(c.Writer, "data: {\"type\":\"token\",\"content\":%s}\n\n", string(escaped))
				c.Writer.Flush()
			case "tool_calls":
				pendingToolCalls = event.ToolCalls
			}
		})

		if err != nil {
			logger.Errorf("[Chat] tool stream error: %v", err)
			fmt.Fprintf(c.Writer, "data: {\"type\":\"error\",\"content\":\"AI service temporarily unavailable\"}\n\n")
			c.Writer.Flush()
			return
		}

		// No tool calls — we're done
		if len(pendingToolCalls) == 0 {
			break
		}

		// Append assistant message with tool calls to conversation
		llmMessages = append(llmMessages, aichatservice.ChatMessage{
			Role:      "assistant",
			Content:   contentBuf.String(),
			ToolCalls: pendingToolCalls,
		})

		// Execute each tool call
		for _, tc := range pendingToolCalls {
			// Send tool_call event to frontend
			tcJSON, _ := json.Marshal(map[string]interface{}{
				"type":      "tool_call",
				"id":        tc.ID,
				"name":      tc.Function.Name,
				"arguments": tc.Function.Arguments,
			})
			fmt.Fprintf(c.Writer, "data: %s\n\n", string(tcJSON))
			c.Writer.Flush()

			// Execute
			result, durationMs, execErr := h.toolRegistry.Execute(tc.Function.Name, tc.Function.Arguments, toolCtx)

			var resultJSON string
			if execErr != nil {
				resultJSON = fmt.Sprintf(`{"error": "%s"}`, execErr.Error())
			} else {
				rb, _ := json.Marshal(result)
				resultJSON = string(rb)
			}

			// Send tool_result event to frontend
			trJSON, _ := json.Marshal(map[string]interface{}{
				"type":        "tool_result",
				"id":          tc.ID,
				"name":        tc.Function.Name,
				"result":      resultJSON,
				"duration_ms": durationMs,
				"success":     execErr == nil,
			})
			fmt.Fprintf(c.Writer, "data: %s\n\n", string(trJSON))
			c.Writer.Flush()

			// Append tool result to conversation for next round
			llmMessages = append(llmMessages, aichatservice.ChatMessage{
				Role:       "tool",
				Content:    resultJSON,
				ToolCallID: tc.ID,
			})
		}
		// Loop back to let LLM generate a response incorporating tool results
	}

	h.finishStream(c, session, fullResponse.String(), userMessage)
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
