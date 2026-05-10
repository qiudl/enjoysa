package tourism_agent

import (
	"context"
	"errors"
	"net/http"
	"time"

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
	// REQ-20260510-0011 dev-2A: optional cache + store for the C-end
	// embedded buttons. Pre-2A handlers (generate-content, pricing-suggest)
	// don't use these — they keep working when the new fields are nil so
	// existing tests don't need to be updated.
	cache *Cache
	store Store
}

func NewHandler(agent *Agent) *Handler {
	return &Handler{agent: agent}
}

// WithCEndCacheStore plumbs in the cache + store for the C-end endpoints
// (Explain / FitCheck / Nearby). Returns the same handler so callers can
// chain on NewHandler. nil store is allowed for tests that only exercise
// the older endpoints.
func (h *Handler) WithCEndCacheStore(cache *Cache, store Store) *Handler {
	h.cache = cache
	h.store = store
	return h
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

// REQ-20260510-0011 Phase 2 dev-2A — C-end "📍 周边还有什么" button.
//
// No LLM call: we just query the KB by (council, category) and return up
// to 5 active entries. Cached 24h because KB content changes slowly and
// the entry list is shared across all users viewing the same product.
//
// Why we accept (council, category) in the body rather than (product_id):
//   - keeps the agent package decoupled from product store internals
//   - the frontend already has the loaded Product so passing the dims
//     adds no extra round-trip
//   - lets future supplier-side use (preview "what's nearby this draft")
//     reuse the endpoint without a saved product

type nearbyRequest struct {
	Category       string `json:"category"`
	Council        string `json:"council"`
	ExcludeProduct uint   `json:"exclude_product_id,omitempty"`
	Limit          int    `json:"limit,omitempty"`
}

type nearbyResponse struct {
	Items  []nearbyItem `json:"items"`
	Cached bool         `json:"cached"`
}

type nearbyItem struct {
	Type    string `json:"type"`
	ID      uint   `json:"id"`
	NameZh  string `json:"name_zh"`
	NameEn  string `json:"name_en,omitempty"`
	Council string `json:"council,omitempty"`
}

const (
	nearbyDefaultLimit = 5
	nearbyMaxLimit     = 5
	nearbyTTL          = 24 * time.Hour
)

// Nearby handles POST /api/v1/ai/tourism/nearby.
//
// Anonymous callers are allowed — this is a pure C-end browsing aid and
// the per-IP rate limiter (cendRateLimiter) on the route group already
// rejects abusive callers without needing auth.
func (h *Handler) Nearby(c *gin.Context) {
	if h.cache == nil || h.store == nil {
		response.ServerError(c, "C-end cache/store not wired")
		return
	}

	var req nearbyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	if req.Category == "" || req.Council == "" {
		response.BadRequest(c, "category and council are required")
		return
	}
	limit := req.Limit
	if limit <= 0 || limit > nearbyMaxLimit {
		limit = nearbyDefaultLimit
	}

	cacheKey := "nearby:" + req.Category + ":" + req.Council
	var items []nearbyItem
	cached, err := h.cache.GetOrCompute(c.Request.Context(), cacheKey, nearbyTTL, &items,
		func(ctx context.Context) (any, error) {
			return h.lookupNearby(ctx, req.Category, req.Council, req.ExcludeProduct, limit)
		})
	if err != nil {
		response.ServerError(c, "Failed to fetch nearby: "+err.Error())
		return
	}

	response.Success(c, nearbyResponse{Items: items, Cached: cached})
}

// lookupNearby is the cache-miss path. Returns up to `limit` KB entries
// matching (council, category), excluding the source product if it
// happens to be in the KB itself (rare, but Phase 1 ETL can sync product
// experiences into tourism_experiences). The exclusion is best-effort
// since matching by ID across two tables (products vs tourism_*) doesn't
// have a strict FK; we just filter post-fetch by ID equality.
func (h *Handler) lookupNearby(
	ctx context.Context,
	category string,
	council string,
	excludeProductID uint,
	limit int,
) ([]nearbyItem, error) {
	hits, err := h.store.SearchKnowledge(ctx, SearchParams{
		Category: category,
		Council:  council,
		Limit:    limit + 1, // pull one extra in case we filter out the source product
	})
	if err != nil {
		return nil, err
	}
	out := make([]nearbyItem, 0, limit)
	for _, h := range hits {
		if excludeProductID > 0 && h.ID == excludeProductID && h.Type == "experience" {
			continue
		}
		out = append(out, nearbyItem{
			Type:    h.Type,
			ID:      h.ID,
			NameZh:  h.NameZh,
			NameEn:  h.NameEn,
			Council: h.Council,
		})
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}
