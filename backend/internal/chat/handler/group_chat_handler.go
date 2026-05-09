// REQ-20260509-0037 dev-3: workspace + channel + agent + membership CRUD.
// dev-4 added the channel send pipeline (group_chat_send.go), wired in via
// AttachLLMSupport from router.go.
// dev-6 wires the aichat tool registry + GLM vision OCR via AttachToolSupport;
// when both are nil the send pipeline still works as a plain text stream.
package handler

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	aichatservice "enjoysa-backend/internal/aichat/service"
	chatmodel "enjoysa-backend/internal/chat/model"
	chatstore "enjoysa-backend/internal/chat/store"
	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/llmprovider"
	"enjoysa-backend/pkg/response"
)

// GroupChatHandler exposes workspace / channel / agent CRUD endpoints
// plus the channel send pipeline (see group_chat_send.go).
type GroupChatHandler struct {
	workspaces *chatstore.WorkspaceStore
	channels   *chatstore.ChannelStore
	members    *chatstore.ChannelMemberStore
	agents     *chatstore.AgentStore

	// Wired by AttachLLMSupport — required for SendChannelMessage (dev-4).
	messages  *chatstore.MessageStore
	providers *llmprovider.Registry

	// Wired by AttachToolSupport (dev-6). All optional: when nil the send
	// pipeline degrades to plain-text streaming with no tool calls / OCR.
	tools     *aichatservice.ToolRegistry
	glmVision *aichatservice.GLMClient
	db        *gorm.DB
}

// AttachToolSupport wires the dev-6 dependencies. Safe to call with any
// subset nil — each capability self-gates on its own pointer.
func (h *GroupChatHandler) AttachToolSupport(tools *aichatservice.ToolRegistry, glm *aichatservice.GLMClient, db *gorm.DB) {
	h.tools = tools
	h.glmVision = glm
	h.db = db
}

func NewGroupChatHandler(
	wsStore *chatstore.WorkspaceStore,
	chStore *chatstore.ChannelStore,
	mbStore *chatstore.ChannelMemberStore,
	agStore *chatstore.AgentStore,
) *GroupChatHandler {
	return &GroupChatHandler{
		workspaces: wsStore,
		channels:   chStore,
		members:    mbStore,
		agents:     agStore,
	}
}

// =====================================================================
// 1. GET /api/v1/chat/v2/workspace
//    Returns the caller's workspace + active channels + global agent list.
//    Idempotently creates the workspace + #客服-默认 channel on first call.
// =====================================================================

type workspaceView struct {
	Workspace *chatmodel.ChatWorkspace `json:"workspace"`
	Channels  []channelView            `json:"channels"`
	Agents    []chatmodel.ChatAgent    `json:"agents"`
}

type channelView struct {
	chatmodel.ChatChannel
	MemberAgentIDs []uint `json:"member_agent_ids"`
}

func (h *GroupChatHandler) GetWorkspace(c *gin.Context) {
	caller, ok := requireOwner(c)
	if !ok {
		return
	}

	ws, err := h.workspaces.GetOrCreateForUser(caller.ID, caller.Type)
	if err != nil {
		logger.Errorf("[group_chat] GetOrCreateForUser: %v", err)
		response.ServerError(c, "failed to load workspace")
		return
	}

	// First-time bootstrap: ensure #客服-默认 exists with default agents.
	if err := h.ensureDefaultChannel(ws.ID); err != nil {
		logger.Errorf("[group_chat] ensureDefaultChannel ws=%d: %v", ws.ID, err)
		response.ServerError(c, "failed to bootstrap default channel")
		return
	}

	channels, err := h.channels.ListByWorkspace(ws.ID, false)
	if err != nil {
		response.ServerError(c, "failed to list channels")
		return
	}
	views := make([]channelView, 0, len(channels))
	for i := range channels {
		ch := &channels[i]
		members, _ := h.members.ListAgents(ch.ID)
		ids := make([]uint, 0, len(members))
		for _, m := range members {
			if m.AgentID != nil {
				ids = append(ids, *m.AgentID)
			}
		}
		views = append(views, channelView{ChatChannel: *ch, MemberAgentIDs: ids})
	}

	agents, err := h.agents.ListEnabled()
	if err != nil {
		response.ServerError(c, "failed to list agents")
		return
	}

	response.Success(c, workspaceView{
		Workspace: ws,
		Channels:  views,
		Agents:    agents,
	})
}

// ensureDefaultChannel creates #kefu-default + adds default-in-new-channel
// agents only if no default channel exists for the workspace yet. Idempotent.
func (h *GroupChatHandler) ensureDefaultChannel(workspaceID uint) error {
	existing, err := h.channels.GetBySlug(workspaceID, chatmodel.DefaultChannelSlug)
	if err == nil && existing != nil {
		return nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	defaults, err := h.agents.ListDefaultsInNewChannel()
	if err != nil {
		return err
	}
	if len(defaults) == 0 {
		return errors.New("no agents seeded with default_in_new_channel=TRUE — run seed first")
	}

	created, err := h.channels.Create(workspaceID, chatstore.CreateInput{
		Name:           chatmodel.DefaultChannelName,
		Description:    "默认客服频道",
		DefaultAgentID: defaults[0].ID,
		IsDefault:      true,
	})
	if err != nil {
		return err
	}
	for _, ag := range defaults {
		if err := h.members.AddAgent(created.ID, ag.ID); err != nil {
			return err
		}
	}
	return nil
}

// =====================================================================
// 2. POST /api/v1/chat/channels — create
// =====================================================================

type createChannelRequest struct {
	Name         string   `json:"name" binding:"required,max=40"`
	Description  string   `json:"description" binding:"max=200"`
	AgentIDs     []uint   `json:"agent_ids" binding:"required,min=1"`
	KeywordRules []string `json:"keyword_rules"`
}

func (h *GroupChatHandler) CreateChannel(c *gin.Context) {
	caller, ok := requireOwner(c)
	if !ok {
		return
	}
	var req createChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request: "+err.Error())
		return
	}

	ws, err := h.workspaces.GetOrCreateForUser(caller.ID, caller.Type)
	if err != nil {
		response.ServerError(c, "failed to load workspace")
		return
	}

	// Validate every supplied agent ID exists & is enabled.
	for _, id := range req.AgentIDs {
		if _, err := h.agents.Get(id); err != nil {
			response.BadRequest(c, "agent id invalid or disabled: "+strconv.Itoa(int(id)))
			return
		}
	}

	created, err := h.channels.Create(ws.ID, chatstore.CreateInput{
		Name:           req.Name,
		Description:    req.Description,
		DefaultAgentID: req.AgentIDs[0],
		KeywordRules:   req.KeywordRules,
	})
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	for _, id := range req.AgentIDs {
		if err := h.members.AddAgent(created.ID, id); err != nil {
			logger.Warnf("[group_chat] AddAgent ch=%d agent=%d: %v", created.ID, id, err)
		}
	}
	response.Created(c, created)
}

// =====================================================================
// 3. PATCH /api/v1/chat/channels/:id — rename / change default agent / rules
// =====================================================================

type updateChannelRequest struct {
	Name           *string   `json:"name" binding:"omitempty,max=40"`
	Description    *string   `json:"description" binding:"omitempty,max=200"`
	DefaultAgentID *uint     `json:"default_agent_id"`
	KeywordRules   *[]string `json:"keyword_rules"`
}

func (h *GroupChatHandler) UpdateChannel(c *gin.Context) {
	if !ownsChannelInPath(c, h) {
		return
	}
	id := mustParseUint(c, "id")
	if id == 0 {
		return
	}
	var req updateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request: "+err.Error())
		return
	}
	if req.DefaultAgentID != nil {
		if _, err := h.agents.Get(*req.DefaultAgentID); err != nil {
			response.BadRequest(c, "default_agent_id invalid or disabled")
			return
		}
		// Make sure target agent is a channel member; auto-join otherwise.
		if isMember, _ := h.members.IsMember(id, *req.DefaultAgentID); !isMember {
			_ = h.members.AddAgent(id, *req.DefaultAgentID)
		}
	}
	updated, err := h.channels.Update(id, chatstore.UpdateInput{
		Name:           req.Name,
		Description:    req.Description,
		DefaultAgentID: req.DefaultAgentID,
		KeywordRules:   req.KeywordRules,
	})
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, updated)
}

// =====================================================================
// 4. POST /api/v1/chat/channels/:id/archive — soft-hide
// =====================================================================

func (h *GroupChatHandler) ArchiveChannel(c *gin.Context) {
	if !ownsChannelInPath(c, h) {
		return
	}
	id := mustParseUint(c, "id")
	if id == 0 {
		return
	}
	if err := h.channels.Archive(id); err != nil {
		if errors.Is(err, chatstore.ErrCannotArchiveDefault) {
			response.BadRequest(c, "default channel cannot be archived")
			return
		}
		response.ServerError(c, "archive failed: "+err.Error())
		return
	}
	response.SuccessMessage(c, "archived")
}

// =====================================================================
// 5. PATCH /api/v1/chat/channels/:id/members/:agent_id — mute toggle
//    Defect-analysis R4: refuses to mute the channel's default agent.
// =====================================================================

type muteRequest struct {
	Muted bool `json:"muted"`
}

func (h *GroupChatHandler) UpdateMember(c *gin.Context) {
	if !ownsChannelInPath(c, h) {
		return
	}
	channelID := mustParseUint(c, "id")
	agentID := mustParseUint(c, "agent_id")
	if channelID == 0 || agentID == 0 {
		return
	}
	var req muteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request: "+err.Error())
		return
	}

	if req.Muted {
		ch, err := h.channels.Get(channelID)
		if err != nil {
			response.NotFound(c, "channel not found")
			return
		}
		if ch.DefaultAgentID != nil && *ch.DefaultAgentID == agentID {
			response.BadRequest(c, "channel default agent cannot be muted (would silence the channel)")
			return
		}
	}
	if err := h.members.SetMute(channelID, agentID, req.Muted); err != nil {
		if errors.Is(err, chatstore.ErrMemberNotFound) {
			response.NotFound(c, "agent is not a channel member")
			return
		}
		response.ServerError(c, "mute failed: "+err.Error())
		return
	}
	response.SuccessMessage(c, "ok")
}

// =====================================================================
// helpers
// =====================================================================

type ownerIdentity struct {
	ID   uint
	Type string // user | supplier | admin
}

func resolveOwner(c *gin.Context) (ownerIdentity, bool) {
	if v, ok := c.Get("supplier_user_id"); ok {
		if id, ok := v.(uint); ok && id > 0 {
			return ownerIdentity{ID: id, Type: "supplier"}, true
		}
	}
	if v, ok := c.Get("admin_id"); ok {
		if id, ok := v.(uint); ok && id > 0 {
			return ownerIdentity{ID: id, Type: "admin"}, true
		}
	}
	if v, ok := c.Get("user_id"); ok {
		if id, ok := v.(uint); ok && id > 0 {
			return ownerIdentity{ID: id, Type: "user"}, true
		}
	}
	return ownerIdentity{}, false
}

func requireOwner(c *gin.Context) (ownerIdentity, bool) {
	owner, ok := resolveOwner(c)
	if !ok {
		response.Unauthorized(c, "login required")
		return owner, false
	}
	return owner, true
}

// ownsChannelInPath enforces defect-analysis S1: channel.workspace.owner
// must match the caller. Uses :id from path. Bails out + writes 401/403/404
// when the check fails.
func ownsChannelInPath(c *gin.Context, h *GroupChatHandler) bool {
	caller, ok := requireOwner(c)
	if !ok {
		return false
	}
	id := mustParseUint(c, "id")
	if id == 0 {
		return false
	}
	ch, err := h.channels.Get(id)
	if err != nil {
		response.NotFound(c, "channel not found")
		return false
	}
	owned, err := h.workspaces.IsOwnedBy(ch.WorkspaceID, caller.ID, caller.Type)
	if err != nil {
		response.ServerError(c, "ownership check failed")
		return false
	}
	if !owned {
		response.NotFound(c, "channel not found") // hide existence
		return false
	}
	return true
}

func mustParseUint(c *gin.Context, key string) uint {
	raw := c.Param(key)
	v, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || v == 0 {
		response.BadRequest(c, "invalid "+key)
		return 0
	}
	return uint(v)
}
