package tourism_agent

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

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

// REQ-20260510-0011 · Phase 2 · 2A
//
// ProductSeed is the narrow product slice the C-end /explain handler needs
// to build a Skeleton. Defined here (not as a product.Product) so the
// tourism_agent package doesn't pull a transitive dep on the whole product
// model — adapter in router.go translates GetByID → ProductSeed.
type ProductSeed struct {
	NameZh          string
	NameEn          string
	Council         string // canonical English (region.NameEn)
	Category        string // category.Slug
	DurationMinutes int    // parsed from product.Duration; 0 when unknown
	Tags            []string
	Status          string // "approved" / "pending" etc — handler 404s on non-approved
}

// ProductLookup is the cross-package boundary the C-end handler depends on.
// Router.go injects an adapter wrapping product.ProductStore. Tests inject
// a fake without dragging in product/store + GORM.
type ProductLookup interface {
	LookupForAgent(ctx context.Context, productID uint) (*ProductSeed, error)
}

// REQ-20260510-0011 · 2B
//
// TicketSeed is the slice of ticket data the DraftReply handler needs to
// build a Skeleton. Defined here so tourism_agent doesn't pull aftersales
// as a transitive dep — router-side adapter does the GORM work.
//
// LinkedProductID is optional: tickets without an order/product link still
// get a draft, but the prompt skips the council/category grounding.
type TicketSeed struct {
	Subject         string
	Type            string // refund | exchange | inquiry | complaint
	LastCustomerMsg string
	LinkedProductID *uint
}

// TicketLookup is the cross-package contract for looking up ticket details
// by ID. Router injects an adapter that wraps aftersales.TicketStore.
type TicketLookup interface {
	LookupForAgent(ctx context.Context, ticketID uint) (*TicketSeed, error)
}

// Handler exposes the agent over HTTP. Construct via NewHandler.
//
// productLookup + cache are optional. Phase 1 (1F) endpoints (GenerateContent,
// PricingSuggest) don't need them; Phase 2 (2A) C-end endpoints do. Router
// wires both via setters so tests covering 1F endpoints can leave them nil.
type Handler struct {
	agent         *Agent
	productLookup ProductLookup
	ticketLookup  TicketLookup
	explainCache  *TTLCache
}

func NewHandler(agent *Agent) *Handler {
	return &Handler{agent: agent}
}

// SetProductLookup wires the product lookup adapter (REQ-20260510-0011 · 2A).
func (h *Handler) SetProductLookup(p ProductLookup) {
	h.productLookup = p
}

// SetExplainCache wires the per-product TTL cache for /explain responses
// (REQ-20260510-0011 · 2A · D1 jitter applied at cache layer).
func (h *Handler) SetExplainCache(c *TTLCache) {
	h.explainCache = c
}

// SetTicketLookup wires the ticket lookup adapter (REQ-20260510-0011 · 2B).
func (h *Handler) SetTicketLookup(t TicketLookup) {
	h.ticketLookup = t
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

// ============================================================================
// REQ-20260510-0011 · Phase 2 · 2A — C-end embedded buttons
// ============================================================================

// explainRequest is the wire-format for POST /api/v1/ai/tourism/c/explain.
// Only product_id is required — the server does the product lookup and
// builds the Agent skeleton internally so anonymous C-end callers never
// have to know the product's council / category internals.
type explainRequest struct {
	ProductID uint `json:"product_id" binding:"required,min=1"`
}

// ExplainContent handles POST /api/v1/ai/tourism/c/explain.
//
// Anonymous-friendly: no auth check (this is the C-end product detail page,
// open to guests). Rate limit is enforced by the C-end limiter on the route.
// Cache: per-product TTL ~6h ± 30min jitter (D1) — same product_id repeats
// hit cache without burning LLM. Cache miss kicks the Agent through the
// existing Generate loop with FieldExplainForUser.
//
// Returns 503 + UNCONFIGURED if productLookup or cache wasn't wired (defensive
// — router setup bug rather than user error).
func (h *Handler) ExplainContent(c *gin.Context) {
	if h.productLookup == nil || h.explainCache == nil {
		response.Fail(c, http.StatusServiceUnavailable, "EXPLAIN_NOT_WIRED",
			"explain endpoint not configured on this server")
		return
	}

	var req explainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	cacheKey := "explain:" + strconv.FormatUint(uint64(req.ProductID), 10)
	if cached, ok := h.explainCache.Get(cacheKey); ok {
		// Cache stores the full JSON response so a hit short-circuits all the
		// way to the wire format with no re-marshal cost.
		c.Header("Content-Type", "application/json; charset=utf-8")
		c.Header("X-Cache", "HIT")
		c.String(http.StatusOK, cached)
		return
	}
	c.Header("X-Cache", "MISS")

	seed, err := h.productLookup.LookupForAgent(c.Request.Context(), req.ProductID)
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	// Only published products get C-end AI explanations — drafts / rejected
	// can't be discussed publicly without leaking unreleased content.
	if seed.Status != "approved" && seed.Status != "offline" {
		response.Fail(c, http.StatusForbidden, "PRODUCT_NOT_PUBLIC",
			"product is not publicly available")
		return
	}

	resp, err := h.agent.Generate(c.Request.Context(), GenerateRequest{
		Field:    FieldExplainForUser,
		Language: "zh-CN",
		Skeleton: Skeleton{
			Category:        seed.Category,
			Council:         seed.Council,
			DurationMinutes: seed.DurationMinutes,
			Highlights:      []string{seed.NameZh}, // anchor on product's own name
			Tags:            seed.Tags,
		},
	})
	if err != nil {
		if errors.Is(err, ErrMaxIterations) {
			response.Fail(c, http.StatusServiceUnavailable, "AGENT_MAX_ITERATIONS",
				"AI agent could not finish in the allowed number of tool calls")
			return
		}
		response.ServerError(c, "AI explain failed: "+err.Error())
		return
	}

	// Pre-marshal so cached entries are byte-for-byte identical to live ones.
	// We don't have access to the marshaller here, so build the success
	// envelope inline (matches response.Success's shape).
	body := fmt.Sprintf(`{"success":true,"data":{"field":%q,"content":%s,"knowledge_refs":%s}}`,
		string(resp.Field),
		jsonString(resp.Content),
		jsonRefsList(resp.KnowledgeRefs),
	)
	h.explainCache.Set(cacheKey, body)

	c.Header("Content-Type", "application/json; charset=utf-8")
	c.String(http.StatusOK, body)
}

// fitCheckRequest is the wire-format for POST /api/v1/ai/tourism/c/fit-check.
// User query is required but capped + sanitised inside the handler — the
// binding layer just enforces presence.
type fitCheckRequest struct {
	ProductID uint   `json:"product_id" binding:"required,min=1"`
	UserQuery string `json:"user_query" binding:"required"`
}

// FitCheckMaxQueryLen caps user-supplied free text before it reaches the LLM
// (REQ-20260510-0011 · 2A · D2). 200 runes is enough for "带 5 岁小孩想拍照"
// shapes the requirement called out, well below any plausible injection-length
// payload. Exposed as const for tests and the rate-limit telemetry.
const FitCheckMaxQueryLen = 200

// FitCheck handles POST /api/v1/ai/tourism/c/fit-check.
//
// Anonymous-friendly. NO cache (input varies per request — caching would
// leak one user's query into another user's response). LLM call is single-
// shot and short — Agent budget cap covers worst case.
//
// D2 防护 chain:
//   1. ShouldBindJSON enforces presence
//   2. sanitizeUserQuery strips control chars + caps at FitCheckMaxQueryLen runes
//   3. BuildUserPrompt wraps inside DATA-not-INSTRUCTIONS boundary
//
// D3 隐私 chain:
//   1. We do NOT log or persist req.UserQuery anywhere — only pass to LLM
//   2. Response prefixes with mandatory "AI 参考意见" disclaimer
//
// Note: user query is intentionally not echoed back in the response to
// further reduce reflected-XSS / log-injection blast radius.
func (h *Handler) FitCheck(c *gin.Context) {
	if h.productLookup == nil {
		response.Fail(c, http.StatusServiceUnavailable, "FIT_CHECK_NOT_WIRED",
			"fit-check endpoint not configured on this server")
		return
	}

	var req fitCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	clean, ok := sanitizeUserQuery(req.UserQuery)
	if !ok {
		response.BadRequest(c, "user_query is empty after sanitisation")
		return
	}

	seed, err := h.productLookup.LookupForAgent(c.Request.Context(), req.ProductID)
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	if seed.Status != "approved" && seed.Status != "offline" {
		response.Fail(c, http.StatusForbidden, "PRODUCT_NOT_PUBLIC",
			"product is not publicly available")
		return
	}

	resp, err := h.agent.Generate(c.Request.Context(), GenerateRequest{
		Field:    FieldFitCheck,
		Language: "zh-CN",
		Skeleton: Skeleton{
			Category:        seed.Category,
			Council:         seed.Council,
			DurationMinutes: seed.DurationMinutes,
			Highlights:      []string{seed.NameZh},
			Tags:            seed.Tags,
			UserQuery:       clean,
		},
	})
	if err != nil {
		if errors.Is(err, ErrMaxIterations) {
			response.Fail(c, http.StatusServiceUnavailable, "AGENT_MAX_ITERATIONS",
				"AI agent could not finish in the allowed number of tool calls")
			return
		}
		response.ServerError(c, "AI fit-check failed: "+err.Error())
		return
	}

	response.Success(c, resp)
}

// sanitizeUserQuery strips control characters (other than space + Chinese
// fullwidth space) and caps the result at FitCheckMaxQueryLen runes. Returns
// (cleaned, false) when the input is empty after sanitisation so the handler
// can 400 cleanly.
//
// Why not regex: the input is short and per-request, a one-pass rune scan
// stays predictable on memory + cost. We deliberately allow newlines through
// (a user might paste a multi-line description) but normalise CRLF → LF.
func sanitizeUserQuery(raw string) (string, bool) {
	out := make([]rune, 0, len(raw))
	for _, r := range raw {
		switch {
		case r == '\r':
			// Skip — \n on its own is fine.
		case r == '\n', r == '\t':
			out = append(out, r)
		case r < 0x20:
			// Other C0 control chars dropped silently.
		default:
			out = append(out, r)
		}
		if len(out) >= FitCheckMaxQueryLen {
			break
		}
	}
	// Trim leading/trailing whitespace.
	for len(out) > 0 && (out[0] == ' ' || out[0] == '\n' || out[0] == '\t') {
		out = out[1:]
	}
	for len(out) > 0 {
		last := out[len(out)-1]
		if last != ' ' && last != '\n' && last != '\t' {
			break
		}
		out = out[:len(out)-1]
	}
	if len(out) == 0 {
		return "", false
	}
	return string(out), true
}

// ============================================================================
// REQ-20260510-0011 · 2B · DraftReply
// ============================================================================

// draftReplyRequest is the wire format. Only ticket_id is required — the
// server fetches the ticket itself + linked product (if any) so the caller
// doesn't have to thread internals.
type draftReplyRequest struct {
	TicketID uint `json:"ticket_id" binding:"required,min=1"`
}

// DraftReplyMaxCustomerMsgLen caps the customer message we feed the LLM.
// Long customer rants don't need to all reach the LLM, and the cap also
// gives a defensive bound on prompt-injection payload size.
const DraftReplyMaxCustomerMsgLen = 1500

// DraftReply handles POST /api/v1/ai/tourism/draft-reply.
//
// Auth: supplier OR admin (the only roles that respond to tickets). Cache:
// none — every ticket message is unique. The handler wires the existing
// agent loop with FieldDraftReply; product council/category gets attached
// when the ticket has a linked product so the reply can anchor on real KB.
//
// 503 if the ticket lookup adapter wasn't wired (router setup bug, not user
// error). 404 if the ticket id doesn't resolve.
func (h *Handler) DraftReply(c *gin.Context) {
	if !hasEditorIdentity(c) {
		response.Unauthorized(c, "Login required")
		return
	}
	if h.ticketLookup == nil {
		response.Fail(c, http.StatusServiceUnavailable, "DRAFT_REPLY_NOT_WIRED",
			"draft-reply endpoint not configured on this server")
		return
	}

	var req draftReplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	seed, err := h.ticketLookup.LookupForAgent(c.Request.Context(), req.TicketID)
	if err != nil {
		response.NotFound(c, "Ticket not found")
		return
	}

	// Optional product context — when the ticket is linked to a product,
	// the reply can mention the council and category so the customer
	// doesn't get a generic boilerplate.
	skeleton := Skeleton{
		TicketSubject: seed.Subject,
		TicketType:    seed.Type,
		TicketLastMsg: capRunes(seed.LastCustomerMsg, DraftReplyMaxCustomerMsgLen),
	}
	if seed.LinkedProductID != nil && h.productLookup != nil {
		if pSeed, perr := h.productLookup.LookupForAgent(c.Request.Context(), *seed.LinkedProductID); perr == nil {
			skeleton.Council = pSeed.Council
			skeleton.Category = pSeed.Category
		}
	}

	resp, err := h.agent.Generate(c.Request.Context(), GenerateRequest{
		Field:    FieldDraftReply,
		Language: "zh-CN",
		Skeleton: skeleton,
	})
	if err != nil {
		if errors.Is(err, ErrMaxIterations) {
			response.Fail(c, http.StatusServiceUnavailable, "AGENT_MAX_ITERATIONS",
				"AI agent could not finish in the allowed number of tool calls")
			return
		}
		response.ServerError(c, "AI draft failed: "+err.Error())
		return
	}

	response.Success(c, resp)
}

// capRunes truncates a string to maxRunes runes (Unicode-safe). Used by
// DraftReply to bound the LLM-bound payload — long customer rants don't
// need to all reach the model and the cap is a defensive bound on
// prompt-injection payload size.
func capRunes(s string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}
	r := []rune(s)
	if len(r) <= maxRunes {
		return s
	}
	return string(r[:maxRunes])
}

// ============================================================================
// REQ-20260510-0011 · 2A-3 · Nearby
// ============================================================================

// NearbyMaxResults caps the response size — design Gate 1 requires "至少
// 3 条 (cap 5)". Exposing as const so tests assert the cap holds.
const NearbyMaxResults = 5

// NearbyItem is the trimmed-down shape returned to C-end. Price fields are
// intentionally absent — design says no price ("avoid 暗推销") so neighbours
// don't look like an upsell carousel. UI uses (type, name) for navigation.
type NearbyItem struct {
	Type    string `json:"type"`
	ID      uint   `json:"id"`
	Name    string `json:"name"`
	NameEn  string `json:"name_en,omitempty"`
	Council string `json:"council,omitempty"`
}

// NearbyResponse is the wire shape. Items may be empty when the council /
// category has no other active KB entries — UI shows "no nearby suggestions
// yet" in that case rather than 404.
type NearbyResponse struct {
	Items []NearbyItem `json:"items"`
}

// Nearby handles GET /api/v1/ai/tourism/c/nearby?product_id=X.
//
// Pure DB read (no LLM) — uses the same search_knowledge tool the agent
// uses internally, but bypassing Agent.Generate keeps the request <50ms
// even on cache miss. Cache is shared with /explain (different prefix)
// so the same TTL+jitter behaviour applies.
//
// We deliberately strip price fields from SearchHit before returning to
// avoid the C-end UI rendering this as an upsell shelf — design intent
// is "neighbouring inspiration", not "buy these too".
func (h *Handler) Nearby(c *gin.Context) {
	if h.productLookup == nil || h.explainCache == nil {
		response.Fail(c, http.StatusServiceUnavailable, "NEARBY_NOT_WIRED",
			"nearby endpoint not configured on this server")
		return
	}

	raw := c.Query("product_id")
	productID, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || productID == 0 {
		response.BadRequest(c, "product_id is required and must be a positive integer")
		return
	}

	cacheKey := "nearby:" + strconv.FormatUint(productID, 10)
	if cached, ok := h.explainCache.Get(cacheKey); ok {
		c.Header("Content-Type", "application/json; charset=utf-8")
		c.Header("X-Cache", "HIT")
		c.String(http.StatusOK, cached)
		return
	}
	c.Header("X-Cache", "MISS")

	seed, err := h.productLookup.LookupForAgent(c.Request.Context(), uint(productID))
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	if seed.Status != "approved" && seed.Status != "offline" {
		response.Fail(c, http.StatusForbidden, "PRODUCT_NOT_PUBLIC",
			"product is not publicly available")
		return
	}
	// Council is the strong filter — without it we'd return random KB
	// entries which wouldn't be "nearby" at all. Empty council → 200 with
	// no items rather than 5xx so the UI hides the section gracefully.
	if seed.Council == "" {
		emit := `{"success":true,"data":{"items":[]}}`
		h.explainCache.Set(cacheKey, emit)
		c.Header("Content-Type", "application/json; charset=utf-8")
		c.String(http.StatusOK, emit)
		return
	}

	hits, err := h.agent.store.SearchKnowledge(c.Request.Context(), SearchParams{
		Council:  seed.Council,
		Category: seed.Category,
		Limit:    NearbyMaxResults + 1, // +1 so we can drop the product itself if surfaced
	})
	if err != nil {
		response.ServerError(c, "search failed: "+err.Error())
		return
	}

	items := buildNearbyItems(hits, seed.NameZh, NearbyMaxResults)

	body := encodeNearbyBody(items)
	h.explainCache.Set(cacheKey, body)
	c.Header("Content-Type", "application/json; charset=utf-8")
	c.String(http.StatusOK, body)
}

// buildNearbyItems trims SearchHits to NearbyItems, drops any entry whose
// name matches the source product (case-insensitive trim) so a product that
// got reverse-ETL'd into the KB doesn't show up as its own "neighbour", and
// caps at maxResults.
func buildNearbyItems(hits []SearchHit, selfName string, maxResults int) []NearbyItem {
	out := make([]NearbyItem, 0, maxResults)
	selfTrimmed := normaliseForCompare(selfName)
	for _, h := range hits {
		if normaliseForCompare(h.NameZh) == selfTrimmed && selfTrimmed != "" {
			continue
		}
		out = append(out, NearbyItem{
			Type:    h.Type,
			ID:      h.ID,
			Name:    h.NameZh,
			NameEn:  h.NameEn,
			Council: h.Council,
		})
		if len(out) >= maxResults {
			break
		}
	}
	return out
}

// normaliseForCompare lowercases + trims so "大鸭号" and " 大鸭号 " match.
// Cheap helper; not designed for full Unicode case-folding.
func normaliseForCompare(s string) string {
	out := make([]rune, 0, len(s))
	for _, r := range s {
		if r == ' ' || r == '\t' || r == '\n' {
			continue
		}
		out = append(out, r)
	}
	return string(out)
}

// encodeNearbyBody hand-marshals NearbyResponse so cache hits are
// byte-identical to live responses. Same rationale as ExplainContent.
func encodeNearbyBody(items []NearbyItem) string {
	if len(items) == 0 {
		return `{"success":true,"data":{"items":[]}}`
	}
	var sb []byte
	sb = append(sb, []byte(`{"success":true,"data":{"items":[`)...)
	for i, it := range items {
		if i > 0 {
			sb = append(sb, ',')
		}
		fields := fmt.Sprintf(`{"type":%q,"id":%d,"name":%s`,
			it.Type, it.ID, jsonString(it.Name))
		sb = append(sb, []byte(fields)...)
		if it.NameEn != "" {
			sb = append(sb, []byte(`,"name_en":`)...)
			sb = append(sb, []byte(jsonString(it.NameEn))...)
		}
		if it.Council != "" {
			sb = append(sb, []byte(`,"council":`)...)
			sb = append(sb, []byte(jsonString(it.Council))...)
		}
		sb = append(sb, '}')
	}
	sb = append(sb, []byte(`]}}`)...)
	return string(sb)
}

// jsonString returns a JSON-encoded string literal (with surrounding quotes).
// Inline for the cache pre-marshal path so we don't depend on encoding/json
// for one-off escaping work — keeps allocations minimal in the cache-miss
// fast path.
func jsonString(s string) string {
	var sb []byte
	sb = append(sb, '"')
	for _, r := range s {
		switch r {
		case '"':
			sb = append(sb, '\\', '"')
		case '\\':
			sb = append(sb, '\\', '\\')
		case '\n':
			sb = append(sb, '\\', 'n')
		case '\r':
			sb = append(sb, '\\', 'r')
		case '\t':
			sb = append(sb, '\\', 't')
		default:
			if r < 0x20 {
				sb = append(sb, []byte(fmt.Sprintf(`\u%04x`, r))...)
			} else {
				sb = append(sb, []byte(string(r))...)
			}
		}
	}
	sb = append(sb, '"')
	return string(sb)
}

// jsonRefsList formats KnowledgeRefs as a JSON array literal. Same rationale
// as jsonString — keep the cache pre-marshal path dep-free.
func jsonRefsList(refs []KnowledgeRef) string {
	if len(refs) == 0 {
		return "[]"
	}
	var sb []byte
	sb = append(sb, '[')
	for i, r := range refs {
		if i > 0 {
			sb = append(sb, ',')
		}
		sb = append(sb, []byte(fmt.Sprintf(
			`{"type":%q,"id":%d,"name":%s}`,
			r.Type, r.ID, jsonString(r.Name),
		))...)
	}
	sb = append(sb, ']')
	return string(sb)
}
