package tourism_agent

import (
	"errors"
	"net/http"

	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

// REQ-20260510-0002 · Phase 1 · 1F
//
// HTTP layer in front of Agent. Two endpoints:
//
//   POST /api/v1/ai/tourism/generate-content
//   POST /api/v1/ai/tourism/pricing-suggest
//
// The router mounts both behind the dedicated 1/s burst-3 rate limiter from
// rate_limit.go so a chatty supplier hammering "AI 生成" doesn't starve the
// other /api/v1/ai/* scenes that share the global 2/s burst-5 limiter.
//
// Auth: both endpoints accept supplier or admin tokens (the only roles that
// edit products). Anonymous callers are rejected inside the handler so the
// router can keep using OptionalAnyAuth without a separate auth-required
// middleware.

// Handler exposes the agent over HTTP. Construct via NewHandler.
type Handler struct {
	agent *Agent
}

func NewHandler(agent *Agent) *Handler {
	return &Handler{agent: agent}
}

// generateContentRequest is the wire-format. The skeleton fields are all
// optional — supplier can hit "AI 生成" before filling everything in. The
// handler maps unknown fields to 400 so the supplier UI can show a clear
// error instead of a generic 500.
type generateContentRequest struct {
	Field    string   `json:"field" binding:"required"`
	Language string   `json:"language"` // optional, defaults to zh-CN inside the agent
	Skeleton struct {
		Category        string   `json:"category"`
		Council         string   `json:"council"`
		DurationMinutes int      `json:"duration_minutes"`
		Highlights      []string `json:"highlights"`
		Tags            []string `json:"tags"`
	} `json:"skeleton"`
}

// GenerateContent handles POST /api/v1/ai/tourism/generate-content.
//
// Caller identity check: the handler trusts whichever auth middleware the
// router picked (OptionalAnyAuth). If neither user_id nor supplier_id nor
// admin_id is set, we 401. We do NOT branch logic on identity beyond that —
// the agent's output is the same for both roles in Phase 1.
func (h *Handler) GenerateContent(c *gin.Context) {
	if !hasEditorIdentity(c) {
		response.Unauthorized(c, "Login required")
		return
	}

	var req generateContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	field := FieldType(req.Field)
	if !IsValidField(field) {
		response.BadRequest(c, "Invalid field: must be one of title, description, highlights, itinerary")
		return
	}

	resp, err := h.agent.Generate(c.Request.Context(), GenerateRequest{
		Field:    field,
		Language: req.Language,
		Skeleton: Skeleton{
			Category:        req.Skeleton.Category,
			Council:         req.Skeleton.Council,
			DurationMinutes: req.Skeleton.DurationMinutes,
			Highlights:      req.Skeleton.Highlights,
			Tags:            req.Skeleton.Tags,
		},
	})
	if err != nil {
		// ErrMaxIterations means the LLM kept asking for tools past the cap —
		// surface as 503 so the UI can show "AI is busy, try again". Other
		// errors (LLM transport, tool exec) bubble up as 500.
		if errors.Is(err, ErrMaxIterations) {
			response.Fail(c, http.StatusServiceUnavailable, "AGENT_MAX_ITERATIONS",
				"AI agent could not finish in the allowed number of tool calls")
			return
		}
		response.ServerError(c, "AI generation failed: "+err.Error())
		return
	}

	response.Success(c, resp)
}

// pricingSuggestRequest is the wire-format for pricing suggestions.
type pricingSuggestRequest struct {
	Category        string `json:"category" binding:"required"`
	Council         string `json:"council" binding:"required"`
	DurationMinutes int    `json:"duration_minutes" binding:"required,min=1"`
	Season          string `json:"season"` // optional → year_round inside the agent
}

// PricingSuggest handles POST /api/v1/ai/tourism/pricing-suggest.
//
// Skips the LLM entirely (D5: SuggestPricing is a pure DB read). Returns a
// 200 with InsufficientData=true when sample_size < 3 so the UI can render a
// "数据不足" banner instead of a fabricated price.
func (h *Handler) PricingSuggest(c *gin.Context) {
	if !hasEditorIdentity(c) {
		response.Unauthorized(c, "Login required")
		return
	}

	var req pricingSuggestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	resp, err := h.agent.SuggestPricing(c.Request.Context(), PricingRequest{
		Category:        req.Category,
		Council:         req.Council,
		DurationMinutes: req.DurationMinutes,
		Season:          req.Season,
	})
	if err != nil {
		response.ServerError(c, "Pricing suggestion failed: "+err.Error())
		return
	}

	response.Success(c, resp)
}

// hasEditorIdentity returns true when the request was authenticated as a
// supplier user or platform admin. Anonymous + plain user tokens are
// rejected because Phase 1 only embeds these endpoints in the supplier and
// admin product editors.
func hasEditorIdentity(c *gin.Context) bool {
	if _, ok := c.Get("supplier_user_id"); ok {
		return true
	}
	if _, ok := c.Get("admin_id"); ok {
		return true
	}
	// Plain consumer-side user_id intentionally not accepted here — those
	// users don't have a product-edit page to embed this in.
	return false
}
