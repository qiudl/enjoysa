// REQ-20260509-0037 dev-5: thread back-end + GET endpoints for channel +
// thread message lists.
//
// Endpoints:
//   GET  /api/v1/chat/channels/:id/messages?before=&limit=
//   GET  /api/v1/chat/threads/:parent_id/messages?limit=
//   POST /api/v1/chat/threads/:parent_id/messages   (SSE)
//
// Defect-analysis fixes wired here:
//   T2 — POST /threads/:parent_id rejects parent.thread_parent_id != NULL
//        (no nested threads). Returns 400 parent_must_be_top_level.
//   T3 — GET /channels/:id reads ListChannelMain which already includes
//        cross-posted thread replies via the partial index.
//   T4 — Send routes with last-agent-replier (router handles).
package handler

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	chatmodel "enjoysa-backend/internal/chat/model"
	chatservice "enjoysa-backend/internal/chat/service"
	chatstore "enjoysa-backend/internal/chat/store"
	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/llmprovider"
	"enjoysa-backend/pkg/response"
)

// =====================================================================
// GET /api/v1/chat/channels/:id/messages
// =====================================================================

type channelMessagesView struct {
	Messages           []messageView `json:"messages"`
	ThreadReplyCounts  map[uint]int64 `json:"thread_reply_counts"`
}

type messageView struct {
	chatmodel.ChatMessage
}

// GetChannelMessages returns paginated channel main flow.
// Defect T3: ListChannelMain includes cross-posted thread replies.
func (h *GroupChatHandler) GetChannelMessages(c *gin.Context) {
	if !ownsChannelInPath(c, h) {
		return
	}
	channelID := mustParseUint(c, "id")
	if channelID == 0 {
		return
	}
	if h.messages == nil {
		response.ServerError(c, "messages store not wired")
		return
	}

	before := uintQuery(c, "before", 0)
	limit := intQuery(c, "limit", 50)

	rows, err := h.messages.ListChannelMain(channelID, before, limit)
	if err != nil {
		response.ServerError(c, "list failed: "+err.Error())
		return
	}

	views := make([]messageView, 0, len(rows))
	parentIDs := make([]uint, 0, len(rows))
	for _, r := range rows {
		views = append(views, messageView{ChatMessage: r})
		// Top-level messages are eligible thread parents; collect their IDs
		// for batch reply-count.
		if r.ThreadParentID == nil {
			parentIDs = append(parentIDs, r.ID)
		}
	}

	counts, err := h.messages.CountThreadRepliesBatch(parentIDs)
	if err != nil {
		logger.Errorf("[group_chat] CountThreadRepliesBatch: %v", err)
		counts = map[uint]int64{}
	}
	if counts == nil {
		counts = map[uint]int64{}
	}

	response.Success(c, channelMessagesView{
		Messages:          views,
		ThreadReplyCounts: counts,
	})
}

// =====================================================================
// GET /api/v1/chat/threads/:parent_id/messages
// =====================================================================

type threadView struct {
	Parent  *chatmodel.ChatMessage `json:"parent"`
	Replies []chatmodel.ChatMessage `json:"replies"`
}

// GetThreadReplies returns the parent + all replies for a thread.
// Ownership verified via parent.channel_id → channel.workspace_id → caller.
func (h *GroupChatHandler) GetThreadReplies(c *gin.Context) {
	if h.messages == nil {
		response.ServerError(c, "messages store not wired")
		return
	}
	caller, ok := requireOwner(c)
	if !ok {
		return
	}
	parentID := mustParseUint(c, "parent_id")
	if parentID == 0 {
		return
	}
	parent, err := h.messages.Get(parentID)
	if err != nil {
		response.NotFound(c, "thread parent not found")
		return
	}
	if !h.callerOwnsParentChannel(caller, parent) {
		response.NotFound(c, "thread parent not found")
		return
	}

	limit := intQuery(c, "limit", 100)
	replies, err := h.messages.ListThreadReplies(parentID, limit)
	if err != nil {
		response.ServerError(c, "list failed: "+err.Error())
		return
	}
	response.Success(c, threadView{Parent: parent, Replies: replies})
}

// =====================================================================
// POST /api/v1/chat/threads/:parent_id/messages — SSE
// =====================================================================

type sendThreadMessageRequest struct {
	Content       string   `json:"content" binding:"required,max=4000"`
	Mentions      []uint   `json:"mentions"`
	AlsoInChannel bool     `json:"also_in_channel"`
	ImageURLs     []string `json:"image_urls"` // accepted; OCR is dev-6
}

func (h *GroupChatHandler) SendThreadMessage(c *gin.Context) {
	if h.messages == nil || h.providers == nil {
		response.ServerError(c, "group chat send not wired")
		return
	}
	caller, ok := requireOwner(c)
	if !ok {
		return
	}
	parentID := mustParseUint(c, "parent_id")
	if parentID == 0 {
		return
	}
	parent, err := h.messages.Get(parentID)
	if err != nil {
		response.NotFound(c, "thread parent not found")
		return
	}
	// T2: only top-level messages can host a thread.
	if parent.ThreadParentID != nil {
		response.BadRequest(c, "parent_must_be_top_level: thread nesting is not supported")
		return
	}
	if parent.ChannelID == nil {
		response.BadRequest(c, "thread parent has no channel — legacy session message?")
		return
	}
	if !h.callerOwnsParentChannel(caller, parent) {
		response.NotFound(c, "thread parent not found")
		return
	}
	channelID := *parent.ChannelID

	var req sendThreadMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request: "+err.Error())
		return
	}
	owner := resolveOwnerView(c)

	// 1. Persist user thread message before SSE so a DB error returns 500.
	pid := parentID
	userMsg, err := h.messages.Append(chatstore.AppendInput{
		ChannelID:      channelID,
		ThreadParentID: &pid,
		SenderType:     "user",
		Mentions:       req.Mentions,
		Content:        req.Content,
		AlsoInChannel:  req.AlsoInChannel,
	})
	if err != nil {
		response.ServerError(c, "failed to persist user message: "+err.Error())
		return
	}

	// 2. Routing inputs.
	channel, err := h.channels.Get(channelID)
	if err != nil {
		response.ServerError(c, "channel load failed")
		return
	}
	members, err := h.members.ListAgents(channelID)
	if err != nil {
		response.ServerError(c, "members load failed")
		return
	}
	allAgents, err := h.agents.ListEnabled()
	if err != nil {
		response.ServerError(c, "agents load failed")
		return
	}
	siblingChannels, _ := h.channels.ListByWorkspace(channel.WorkspaceID, false)

	// Existing thread replies (for last-agent-replier routing).
	threadHistory, err := h.messages.ListThreadReplies(parentID, 100)
	if err != nil {
		logger.Errorf("[group_chat] thread history load: %v", err)
	}
	threadAgentRepliers := make([]uint, 0, len(threadHistory))
	for _, m := range threadHistory {
		if m.SenderType == "ai" && m.SenderAgentID != nil {
			// Skip the just-saved user msg if it appears (it shouldn't — sender_type=user).
			threadAgentRepliers = append(threadAgentRepliers, *m.SenderAgentID)
		}
	}

	decision := chatservice.Route(chatservice.RouteRequest{
		Channel:             channel,
		ChannelMembers:      members,
		OtherChannels:       siblingChannels,
		AllAgents:           allAgents,
		MessageText:         req.Content,
		Mentions:            req.Mentions,
		InThread:            true,
		ThreadAgentRepliers: threadAgentRepliers,
	})

	// 3. SSE.
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	writeSSE(c, "user", map[string]any{
		"id":               userMsg.ID,
		"thread_parent_id": parentID,
		"content":          userMsg.Content,
		"mentions":         req.Mentions,
		"also_in_channel":  req.AlsoInChannel,
		"created_at":       userMsg.CreatedAt,
	})

	if decision.Agent == nil {
		writeSSE(c, "error", map[string]any{
			"category":  "no_responder",
			"hint":      "thread 里没有可应答的 agent；请 @ 一个 agent 或调整 mute 设置。",
			"soft_hint": decision.SoftHint,
		})
		writeSSE(c, "done", map[string]any{})
		return
	}

	writeSSE(c, "route", map[string]any{
		"agent": map[string]any{
			"id":           decision.Agent.ID,
			"code":         decision.Agent.Code,
			"name":         decision.Agent.Name,
			"avatar_emoji": decision.Agent.AvatarEmoji,
			"color_hex":    decision.Agent.ColorHex,
		},
		"reason":              decision.Reason,
		"ephemeral_in_thread": decision.EphemeralInThread,
		"soft_hint":           decision.SoftHint,
	})

	// 4. Build prompt with thread context: parent + thread replies + just-sent message.
	parentSenderName := h.resolveSenderName(parent, allAgents, owner)
	otherMembers := otherChannelMembersAsAgents(allAgents, members, decision.Agent.ID)

	// Use thread history (chronological) as the prompt history; parent is
	// captured separately in PromptContext.ThreadParent so the LLM sees it as
	// the topic header.
	hist := []chatservice.HistoryMessage{}
	hist = append(hist, chatservice.HistoryMessage{
		SenderType:    parent.SenderType,
		SenderDisplay: parentSenderName,
		Content:       parent.Content,
	})
	hist = append(hist, toHistoryMessages(threadHistory, allAgents, owner)...)
	// Append the just-sent user message at the end of history.
	hist = append(hist, chatservice.HistoryMessage{
		SenderType:    "user",
		SenderDisplay: ownerDisplay(owner),
		Content:       req.Content,
	})

	promptCtx := chatservice.PromptContext{
		Owner:              owner,
		Channel:            *channel,
		GroupMembers:       otherMembers,
		OtherChannels:      siblingChannels,
		Responder:          *decision.Agent,
		InThread:           true,
		ThreadParent:       parent,
		ThreadParentSender: parentSenderName,
		History:            hist,
		SoftHint:           decision.SoftHint,
	}
	llmMessages := chatservice.BuildMessages(promptCtx)

	// 5. Stream.
	provider, perr := h.providers.Get(decision.Agent.LLMProvider)
	if perr != nil {
		writeSSE(c, "error", map[string]any{
			"category": "bad_provider",
			"hint":     "agent 配置的 LLM provider 未注册：" + decision.Agent.LLMProvider,
			"detail":   perr.Error(),
		})
		writeSSE(c, "done", map[string]any{})
		return
	}

	var assembled strings.Builder
	streamErr := provider.ChatStream(c.Request.Context(), llmprovider.Request{
		Model:    decision.Agent.LLMModel,
		Messages: llmMessages,
	}, func(ev llmprovider.StreamEvent) bool {
		switch ev.Type {
		case "content":
			if ev.Content != "" {
				assembled.WriteString(ev.Content)
				writeSSE(c, "content", map[string]any{"content": ev.Content})
			}
		}
		return c.Request.Context().Err() == nil
	})
	if streamErr != nil && !errors.Is(streamErr, context.Canceled) {
		writeSSE(c, "error", map[string]any{
			"category": "llm_stream_error",
			"hint":     "LLM 调用失败",
			"detail":   streamErr.Error(),
		})
	}

	// 6. Persist agent reply (always thread-only — agents never auto-cross-post).
	if assembled.Len() > 0 {
		agentID := decision.Agent.ID
		_, perr := h.messages.Append(chatstore.AppendInput{
			ChannelID:      channelID,
			ThreadParentID: &pid,
			SenderType:     "ai",
			SenderAgentID:  &agentID,
			Content:        assembled.String(),
			AlsoInChannel:  false,
		})
		if perr != nil {
			logger.Errorf("[group_chat] persist thread assistant: %v", perr)
		}
	}

	writeSSE(c, "done", map[string]any{})
}

// =====================================================================
// helpers
// =====================================================================

func (h *GroupChatHandler) callerOwnsParentChannel(caller ownerIdentity, parent *chatmodel.ChatMessage) bool {
	if parent.ChannelID == nil {
		return false
	}
	ch, err := h.channels.Get(*parent.ChannelID)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			logger.Errorf("[group_chat] channel load: %v", err)
		}
		return false
	}
	owned, err := h.workspaces.IsOwnedBy(ch.WorkspaceID, caller.ID, caller.Type)
	if err != nil {
		logger.Errorf("[group_chat] ownership: %v", err)
		return false
	}
	return owned
}

func (h *GroupChatHandler) resolveSenderName(m *chatmodel.ChatMessage, agents []chatmodel.ChatAgent, owner chatservice.OwnerView) string {
	switch m.SenderType {
	case "ai":
		if m.SenderAgentID != nil {
			for _, a := range agents {
				if a.ID == *m.SenderAgentID {
					return a.Name
				}
			}
		}
	case "user", "human":
		return ownerDisplay(owner)
	}
	return m.SenderType
}

func uintQuery(c *gin.Context, key string, def uint) uint {
	raw := c.Query(key)
	if raw == "" {
		return def
	}
	v, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return def
	}
	return uint(v)
}

func intQuery(c *gin.Context, key string, def int) int {
	raw := c.Query(key)
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return v
}
