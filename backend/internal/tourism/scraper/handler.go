package scraper

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	tourismmodel "enjoysa-backend/internal/tourism/model"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// REQ-20260510-0011 · 2C-2 · handler.go
//
// HTTP layer for the admin-triggered scrape pipeline. Mounted under
// /api/v1/admin/tourism/scrape/* inside the existing super_admin group —
// scraping is platform-level operations, not per-supplier.
//
// Endpoints:
//   POST   /run                     — kick off scrape (long-poll, 1-2 min)
//   GET    /jobs/:id                — poll job progress (id in URL)
//   GET    /staging                 — list staging rows (?status=&page=)
//   POST   /staging/:id/promote     — write to tourism_attractions, mark promoted
//   POST   /staging/:id/reject      — mark rejected with reason

// AttractionWriter is the cross-package contract for promoting a staging
// row into the live tourism_attractions table. The router wires the
// existing admin store (tourism/store.AdminStore.CreateAttraction).
type AttractionWriter interface {
	CreateAttraction(ctx context.Context, a *tourismmodel.Attraction) error
}

// HandlerStore is the narrow store interface the handler depends on.
// Subset of the full *Store — keeps test mocks small.
type HandlerStore interface {
	GetJob(ctx context.Context, id string) (*Job, error)
	ListStaging(ctx context.Context, status string, page, pageSize int) ([]Staging, int64, error)
	GetStaging(ctx context.Context, id uint) (*Staging, error)
	MarkPromoted(ctx context.Context, id uint, attractionID uint, reviewedBy *uint) error
	MarkRejected(ctx context.Context, id uint, reason string, reviewedBy *uint) error
}

// Runner is the narrow interface for kicking off a scrape. Service satisfies
// it; tests can fake to avoid running real HTTP/LLM machinery.
type Runner interface {
	RunSync(ctx context.Context, triggeredBy *uint) (*Job, error)
}

// Handler ties Runner + HandlerStore + AttractionWriter together. All three
// are required — nil ones cause 503 NOT_WIRED rather than panicking.
type Handler struct {
	runner    Runner
	store     HandlerStore
	promoter  AttractionWriter
}

func NewHandler(runner Runner, store HandlerStore, promoter AttractionWriter) *Handler {
	return &Handler{runner: runner, store: store, promoter: promoter}
}

// adminID extracts the authenticated admin id from the gin context, returns
// nil if absent (router shouldn't allow that, but defend against misconfig).
func adminID(c *gin.Context) *uint {
	if v, ok := c.Get("admin_id"); ok {
		if id, ok := v.(uint); ok {
			return &id
		}
	}
	return nil
}

// ===========================================================================
// POST /run — synchronous (long-poll) scrape
// ===========================================================================

func (h *Handler) RunScrape(c *gin.Context) {
	if h.runner == nil {
		response.Fail(c, http.StatusServiceUnavailable, "SCRAPER_NOT_WIRED",
			"scrape runner not configured on this server")
		return
	}

	job, err := h.runner.RunSync(c.Request.Context(), adminID(c))
	if err != nil {
		if errors.Is(err, ErrJobAlreadyRunning) {
			response.Fail(c, http.StatusConflict, "SCRAPE_JOB_RUNNING",
				"another scrape job for this source is already running")
			return
		}
		response.ServerError(c, "scrape failed: "+err.Error())
		return
	}
	response.Success(c, job)
}

// ===========================================================================
// GET /jobs/:id — poll progress
// ===========================================================================

func (h *Handler) GetJob(c *gin.Context) {
	if h.store == nil {
		response.Fail(c, http.StatusServiceUnavailable, "SCRAPER_NOT_WIRED", "store not wired")
		return
	}
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "id path param required")
		return
	}
	job, err := h.store.GetJob(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "job not found")
			return
		}
		response.ServerError(c, "lookup failed: "+err.Error())
		return
	}
	response.Success(c, job)
}

// ===========================================================================
// GET /staging?status=pending&page=1&page_size=20
// ===========================================================================

func (h *Handler) ListStaging(c *gin.Context) {
	if h.store == nil {
		response.Fail(c, http.StatusServiceUnavailable, "SCRAPER_NOT_WIRED", "store not wired")
		return
	}
	status := c.Query("status") // empty = all statuses
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))

	rows, total, err := h.store.ListStaging(c.Request.Context(), status, page, pageSize)
	if err != nil {
		response.ServerError(c, "list failed: "+err.Error())
		return
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	response.Paginated(c, rows, total, page, pageSize)
}

// ===========================================================================
// POST /staging/:id/promote — write to tourism_attractions + mark promoted
// ===========================================================================

func (h *Handler) PromoteStaging(c *gin.Context) {
	if h.store == nil || h.promoter == nil {
		response.Fail(c, http.StatusServiceUnavailable, "SCRAPER_NOT_WIRED",
			"store or promoter not wired")
		return
	}
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}

	st, err := h.store.GetStaging(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "staging row not found")
			return
		}
		response.ServerError(c, "lookup failed: "+err.Error())
		return
	}
	if st.Status != StagingStatusPending {
		response.Fail(c, http.StatusConflict, "STAGING_NOT_PENDING",
			"staging row is not in pending state (current: "+st.Status+")")
		return
	}

	attraction, err := buildAttractionFromStaging(st)
	if err != nil {
		response.BadRequest(c, "cannot build attraction from staging: "+err.Error())
		return
	}

	if err := h.promoter.CreateAttraction(c.Request.Context(), attraction); err != nil {
		response.ServerError(c, "promote insert failed: "+err.Error())
		return
	}

	if err := h.store.MarkPromoted(c.Request.Context(), id, attraction.ID, adminID(c)); err != nil {
		// The attraction row exists but we couldn't mark staging promoted.
		// Surface as 500 + include the new attraction id so the admin can
		// reconcile manually (rare edge case).
		response.Fail(c, http.StatusInternalServerError, "PROMOTE_PARTIAL",
			"created attraction id="+strconv.FormatUint(uint64(attraction.ID), 10)+
				" but failed to mark staging row promoted: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"staging_id":     id,
		"attraction_id":  attraction.ID,
	})
}

// ===========================================================================
// POST /staging/:id/reject
// ===========================================================================

type rejectReq struct {
	Reason string `json:"reason"`
}

func (h *Handler) RejectStaging(c *gin.Context) {
	if h.store == nil {
		response.Fail(c, http.StatusServiceUnavailable, "SCRAPER_NOT_WIRED", "store not wired")
		return
	}
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	var req rejectReq
	_ = c.ShouldBindJSON(&req) // reason is optional

	if err := h.store.MarkRejected(c.Request.Context(), id, req.Reason, adminID(c)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "staging row not found or not in pending state")
			return
		}
		response.ServerError(c, "reject failed: "+err.Error())
		return
	}
	response.SuccessMessage(c, "rejected")
}

// ===========================================================================
// Helpers
// ===========================================================================

func parseUintParam(c *gin.Context, name string) (uint, bool) {
	raw := c.Param(name)
	v, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || v == 0 {
		response.BadRequest(c, "invalid "+name)
		return 0, false
	}
	return uint(v), true
}

// buildAttractionFromStaging maps an ExtractedPayload (stored as JSONB on
// the staging row) into a tourism_attractions Attraction model.
//
// IsActive intentionally false — admin must visit the existing admin
// tourism page and explicitly toggle it on (D2: cold-start data is
// admin-gated). Source set to "scraped" + SourceRef set to the original URL
// for traceability.
func buildAttractionFromStaging(st *Staging) (*tourismmodel.Attraction, error) {
	if st == nil {
		return nil, errors.New("nil staging")
	}

	var payload ExtractedPayload
	raw, err := st.ExtractedPayload.MarshalJSON()
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	if payload.NameZh == "" {
		return nil, errors.New("name_zh is required to promote")
	}

	now := time.Now()
	_ = now // gorm fills CreatedAt; kept for future audit if needed

	tags := payload.Tags
	if tags == nil {
		tags = []string{}
	}
	bestSeasons := payload.BestSeasons
	if bestSeasons == nil {
		bestSeasons = []string{}
	}

	return &tourismmodel.Attraction{
		NameZh:      payload.NameZh,
		NameEn:      payload.NameEn,
		Council:     payload.Council,
		Category:    payload.Category,
		Tags:        tags,
		BestSeasons: bestSeasons,
		Description: payload.DescriptionZh,
		Source:      tourismmodel.SourceScraped,
		SourceRef:   st.SourceURL,
		IsActive:    false, // D2: admin must activate after review
	}, nil
}
