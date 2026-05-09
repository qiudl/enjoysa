// REQ-20260509-0037 dev-4: channel main-flow send endpoint.
//
// POST /api/v1/chat/channels/:id/messages
//
// Pipeline:
//   1. validate ownership (ownsChannelInPath)
//   2. parse body { content, mentions[], image_urls[] (TODO dev-6) }
//   3. persist user message (channel_id, sender_type=user, mentions[])
//   4. load entities (channel + members + agents + sibling channels)
//   5. Route() → Decision
//      - no_responder → SSE "error" event + done
//   6. emit SSE "user" + "route" events
//   7. load main-flow history (last 30) + build prompt messages
//   8. fetch LLMProvider from registry by responder.LLMProvider
//   9. stream content; flush each chunk; accumulate
//  10. persist assistant message with sender_agent_id
//  11. emit SSE "done"
//
// Tools (agent.tool_keys ∩ user_type) are NOT wired here — that's dev-6.
// Image OCR (image_urls → GLM vision) also dev-6.
package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	authmodel "enjoysa-backend/internal/auth/model"
	chatmodel "enjoysa-backend/internal/chat/model"
	chatservice "enjoysa-backend/internal/chat/service"
	chatstore "enjoysa-backend/internal/chat/store"
	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/llmprovider"
	"enjoysa-backend/internal/models"
	"enjoysa-backend/pkg/response"
)

// AttachLLMSupport wires the dependencies needed for SendChannelMessage.
// Called once in router.go after constructing GroupChatHandler.
func (h *GroupChatHandler) AttachLLMSupport(messages *chatstore.MessageStore, registry *llmprovider.Registry) {
	h.messages = messages
	h.providers = registry
}

type sendChannelMessageRequest struct {
	Content   string   `json:"content" binding:"required,max=4000"`
	Mentions  []uint   `json:"mentions"`
	ImageURLs []string `json:"image_urls"` // accepted but ignored in dev-4
}

// SendChannelMessage handles POST /api/v1/chat/channels/:id/messages.
func (h *GroupChatHandler) SendChannelMessage(c *gin.Context) {
	if !ownsChannelInPath(c, h) {
		return
	}
	channelID := mustParseUint(c, "id")
	if channelID == 0 {
		return
	}

	var req sendChannelMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request: "+err.Error())
		return
	}
	owner := resolveOwnerView(c)

	if h.messages == nil || h.providers == nil {
		response.ServerError(c, "group chat send not wired (messages or providers nil)")
		return
	}

	// 1. Persist user message — done before SSE so an error here returns 500
	//    instead of a half-streamed response.
	userMsg, err := h.messages.Append(chatstore.AppendInput{
		ChannelID:  channelID,
		SenderType: "user",
		Mentions:   req.Mentions,
		Content:    req.Content,
	})
	if err != nil {
		response.ServerError(c, "failed to persist user message: "+err.Error())
		return
	}

	// 2. Load routing inputs.
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

	// Sibling channels for soft-hint scanning.
	siblingChannels := []chatmodel.ChatChannel{}
	if h.channels != nil {
		ws := channel.WorkspaceID
		all, sErr := h.channels.ListByWorkspace(ws, false)
		if sErr == nil {
			siblingChannels = all
		}
	}

	decision := chatservice.Route(chatservice.RouteRequest{
		Channel:        channel,
		ChannelMembers: members,
		OtherChannels:  siblingChannels,
		AllAgents:      allAgents,
		MessageText:    req.Content,
		Mentions:       req.Mentions,
		InThread:       false,
	})

	// 3. SSE headers + initial events.
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	writeSSE(c, "user", map[string]any{
		"id":         userMsg.ID,
		"content":    userMsg.Content,
		"mentions":   req.Mentions,
		"created_at": userMsg.CreatedAt,
	})

	if decision.Agent == nil {
		writeSSE(c, "error", map[string]any{
			"category":  "no_responder",
			"hint":      "频道里没有可应答的 agent；请 @ 一个 agent 或调整 mute 设置。",
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
		"reason":    decision.Reason,
		"soft_hint": decision.SoftHint,
	})

	// 4. Build prompt history from channel main flow (excludes the just-saved user msg
	//    only if we ask the store for messages strictly *before* userMsg.ID).
	history, err := h.messages.ListChannelMain(channelID, userMsg.ID, 30)
	if err != nil {
		logger.Errorf("[group_chat] ListChannelMain: %v", err)
	}

	otherMembers := otherChannelMembersAsAgents(allAgents, members, decision.Agent.ID)

	promptCtx := chatservice.PromptContext{
		Owner:         owner,
		Channel:       *channel,
		GroupMembers:  otherMembers,
		OtherChannels: siblingChannels,
		Responder:     *decision.Agent,
		History:       toHistoryMessages(history, allAgents, owner),
		SoftHint:      decision.SoftHint,
	}
	// Append the just-sent user message at the end of history.
	promptCtx.History = append(promptCtx.History, chatservice.HistoryMessage{
		SenderType:    "user",
		SenderDisplay: ownerDisplay(owner),
		Content:       req.Content,
	})
	llmMessages := chatservice.BuildMessages(promptCtx)

	// 5. Stream from provider.
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
		case "done":
			// Final flush handled below; intentionally don't emit "done" here
			// — we still need to persist before signaling done.
		}
		return c.Request.Context().Err() == nil
	})
	if streamErr != nil && streamErr != context.Canceled {
		writeSSE(c, "error", map[string]any{
			"category": "llm_stream_error",
			"hint":     "LLM 调用失败",
			"detail":   streamErr.Error(),
		})
	}

	// 6. Persist assistant message (even on partial completion if any content arrived).
	if assembled.Len() > 0 {
		agentID := decision.Agent.ID
		_, perr := h.messages.Append(chatstore.AppendInput{
			ChannelID:     channelID,
			SenderType:    "ai",
			SenderAgentID: &agentID,
			Content:       assembled.String(),
		})
		if perr != nil {
			logger.Errorf("[group_chat] persist assistant: %v", perr)
		}
	}

	writeSSE(c, "done", map[string]any{})
}

// =====================================================================
// helpers
// =====================================================================

// resolveOwnerView extracts the owner identity + display name from gin
// context populated by OptionalAnyAuth.
func resolveOwnerView(c *gin.Context) chatservice.OwnerView {
	if v, ok := c.Get("supplier_user"); ok {
		if su, ok := v.(*models.SupplierUser); ok && su != nil {
			name := su.Name
			if name == "" && su.Supplier != nil {
				name = su.Supplier.Name
			}
			return chatservice.OwnerView{UserID: su.ID, UserType: "supplier", Name: name}
		}
	}
	if v, ok := c.Get("admin"); ok {
		if a, ok := v.(*authmodel.Admin); ok && a != nil {
			return chatservice.OwnerView{UserID: a.ID, UserType: "admin", Name: a.Name}
		}
	}
	if v, ok := c.Get("user"); ok {
		if u, ok := v.(*models.User); ok && u != nil {
			return chatservice.OwnerView{UserID: u.ID, UserType: "user", Name: u.Name}
		}
	}
	return chatservice.OwnerView{}
}

func ownerDisplay(o chatservice.OwnerView) string {
	if o.Name != "" {
		return o.Name
	}
	return fmt.Sprintf("%s#%d", o.UserType, o.UserID)
}

// otherChannelMembersAsAgents returns the agents in the channel except `excludeAgentID`.
func otherChannelMembersAsAgents(all []chatmodel.ChatAgent, members []chatmodel.ChatChannelMember, excludeAgentID uint) []chatmodel.ChatAgent {
	idx := make(map[uint]chatmodel.ChatAgent, len(all))
	for _, a := range all {
		idx[a.ID] = a
	}
	out := make([]chatmodel.ChatAgent, 0, len(members))
	for _, m := range members {
		if m.AgentID == nil {
			continue
		}
		id := *m.AgentID
		if id == excludeAgentID {
			continue
		}
		if a, ok := idx[id]; ok {
			out = append(out, a)
		}
	}
	return out
}

func toHistoryMessages(rows []chatmodel.ChatMessage, agents []chatmodel.ChatAgent, owner chatservice.OwnerView) []chatservice.HistoryMessage {
	idx := map[uint]string{}
	for _, a := range agents {
		idx[a.ID] = a.Name
	}
	out := make([]chatservice.HistoryMessage, 0, len(rows))
	for _, r := range rows {
		display := ""
		switch r.SenderType {
		case "ai":
			if r.SenderAgentID != nil {
				display = idx[*r.SenderAgentID]
			}
		case "user", "human":
			display = ownerDisplay(owner)
		}
		out = append(out, chatservice.HistoryMessage{
			SenderType:    nonEmpty(r.SenderType, "user"),
			SenderDisplay: display,
			Content:       r.Content,
		})
	}
	return out
}

func nonEmpty(a, fallback string) string {
	if a != "" {
		return a
	}
	return fallback
}

// writeSSE serializes payload as JSON with a "type" field and writes one SSE frame.
func writeSSE(c *gin.Context, eventType string, payload map[string]any) {
	if payload == nil {
		payload = map[string]any{}
	}
	payload["type"] = eventType
	bytes, err := json.Marshal(payload)
	if err != nil {
		logger.Errorf("[group_chat] sse marshal: %v", err)
		return
	}
	fmt.Fprintf(c.Writer, "data: %s\n\n", bytes)
	if f, ok := c.Writer.(http.Flusher); ok {
		f.Flush()
	}
}
