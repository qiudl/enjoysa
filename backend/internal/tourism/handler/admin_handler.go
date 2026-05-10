// Package handler exposes the admin CRUD HTTP layer for the tourism
// knowledge base.
//
// REQ-20260510-0002 · 南澳旅游 AI Agent · Phase 1 · 1C
//
// Five RESTful endpoint sets, all under /api/v1/admin/tourism/*. The router
// must mount these inside the super_admin group: knowledge-base curation is
// platform-level work and the RBAC matrix has no per-row "tourism.manage"
// authority yet (a future migration can split it out without changing the
// handler shape).
package handler

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	tourismmodel "enjoysa-backend/internal/tourism/model"
	tourismstore "enjoysa-backend/internal/tourism/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Store is the narrow set of admin-store ops the handler depends on. We
// take an interface (rather than the concrete *tourismstore.AdminStore) so
// handler tests can inject fakes and exercise the full HTTP pipeline
// without a Postgres dependency. The concrete *tourismstore.AdminStore
// satisfies this interface verbatim.
type Store interface {
	// Attractions
	ListAttractions(ctx context.Context, f tourismstore.AttractionFilter) ([]tourismmodel.Attraction, int64, error)
	GetAttraction(ctx context.Context, id uint) (*tourismmodel.Attraction, error)
	CreateAttraction(ctx context.Context, a *tourismmodel.Attraction) error
	UpdateAttraction(ctx context.Context, a *tourismmodel.Attraction) error
	DeleteAttraction(ctx context.Context, id uint) error

	// Accommodations
	ListAccommodations(ctx context.Context, f tourismstore.AccommodationFilter) ([]tourismmodel.Accommodation, int64, error)
	GetAccommodation(ctx context.Context, id uint) (*tourismmodel.Accommodation, error)
	CreateAccommodation(ctx context.Context, a *tourismmodel.Accommodation) error
	UpdateAccommodation(ctx context.Context, a *tourismmodel.Accommodation) error
	DeleteAccommodation(ctx context.Context, id uint) error

	// Food
	ListFood(ctx context.Context, f tourismstore.FoodFilter) ([]tourismmodel.Food, int64, error)
	GetFood(ctx context.Context, id uint) (*tourismmodel.Food, error)
	CreateFood(ctx context.Context, a *tourismmodel.Food) error
	UpdateFood(ctx context.Context, a *tourismmodel.Food) error
	DeleteFood(ctx context.Context, id uint) error

	// Experiences
	ListExperiences(ctx context.Context, f tourismstore.ExperienceFilter) ([]tourismmodel.Experience, int64, error)
	GetExperience(ctx context.Context, id uint) (*tourismmodel.Experience, error)
	CreateExperience(ctx context.Context, a *tourismmodel.Experience) error
	UpdateExperience(ctx context.Context, a *tourismmodel.Experience) error
	DeleteExperience(ctx context.Context, id uint) error

	// Pricing benchmarks
	ListPricingBenchmarks(ctx context.Context, f tourismstore.PricingBenchmarkFilter) ([]tourismmodel.PricingBenchmark, int64, error)
	GetPricingBenchmark(ctx context.Context, id uint) (*tourismmodel.PricingBenchmark, error)
	CreatePricingBenchmark(ctx context.Context, a *tourismmodel.PricingBenchmark) error
	UpdatePricingBenchmark(ctx context.Context, a *tourismmodel.PricingBenchmark) error
	DeletePricingBenchmark(ctx context.Context, id uint) error
}

// AdminHandler holds the Store interface — all gin handlers are pure
// functions of (req, store).
type AdminHandler struct {
	store Store
}

func NewAdminHandler(store Store) *AdminHandler {
	return &AdminHandler{store: store}
}

// parseUintParam reads :id from the path and returns it as a uint. On error
// it writes a 400 to the context and signals via ok=false so the caller can
// short-circuit.
func parseUintParam(c *gin.Context, name string) (uint, bool) {
	raw := c.Param(name)
	v, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || v == 0 {
		response.BadRequest(c, "Invalid "+name)
		return 0, false
	}
	return uint(v), true
}

// parseIntQuery is a shared int parser for page / page_size that defaults
// to zero on parse error so the store layer's clamp can take over.
func parseIntQuery(c *gin.Context, name string) int {
	raw := c.Query(name)
	if raw == "" {
		return 0
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}
	return n
}

// parseBoolQuery returns nil when the param is absent, *true / *false
// otherwise. Anything else is treated as nil (no filter) so a typo doesn't
// flip the gate silently.
func parseBoolQuery(c *gin.Context, name string) *bool {
	raw := c.Query(name)
	switch raw {
	case "true", "1":
		t := true
		return &t
	case "false", "0":
		f := false
		return &f
	default:
		return nil
	}
}

// writeStoreError maps store-layer errors to canonical HTTP responses.
// Centralised so every handler returns the same shape on the same failure
// (404 for missing rows, 409 for unique-key collisions, 500 otherwise).
func writeStoreError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		response.NotFound(c, "Resource not found")
	case errors.Is(err, tourismstore.ErrDuplicate):
		response.Fail(c, http.StatusConflict, "DUPLICATE_PRICING_BENCHMARK",
			"A pricing benchmark with the same (category, council, duration_bucket, season) already exists")
	default:
		response.ServerError(c, "Internal error: "+err.Error())
	}
}

// ============================================================================
// Attractions
// ============================================================================

// AttractionRequest is the wire-format for create / update. We default
// IsActive to true on the request layer so admin-entered rows show up to
// the agent immediately (D2 only gates ETL-imported rows). Callers can
// still pass `"is_active": false` to stage a draft.
type AttractionRequest struct {
	NameZh                 string   `json:"name_zh" binding:"required"`
	NameEn                 string   `json:"name_en"`
	Council                string   `json:"council"`
	Category               string   `json:"category"`
	Tags                   []string `json:"tags"`
	PriceRangeMin          *float64 `json:"price_range_min"`
	PriceRangeMax          *float64 `json:"price_range_max"`
	TypicalDurationMinutes *int     `json:"typical_duration_minutes"`
	BestSeasons            []string `json:"best_seasons"`
	Description            string   `json:"description"`
	Source                 string   `json:"source"`
	SourceRef              string   `json:"source_ref"`
	IsActive               *bool    `json:"is_active"`
}

func (h *AdminHandler) ListAttractions(c *gin.Context) {
	f := tourismstore.AttractionFilter{
		Council:  c.Query("council"),
		Category: c.Query("category"),
		Keywords: c.Query("keywords"),
		IsActive: parseBoolQuery(c, "is_active"),
		Page:     parseIntQuery(c, "page"),
		PageSize: parseIntQuery(c, "page_size"),
	}
	rows, total, err := h.store.ListAttractions(c.Request.Context(), f)
	if err != nil {
		response.ServerError(c, "Failed to list attractions: "+err.Error())
		return
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}
	pageSize := f.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	response.Paginated(c, rows, total, page, pageSize)
}

func (h *AdminHandler) GetAttraction(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := h.store.GetAttraction(c.Request.Context(), id)
	if err != nil {
		writeStoreError(c, err)
		return
	}
	response.Success(c, row)
}

// applyAttractionRequest copies request fields onto the model. Used by both
// Create and Update so the field list lives in one place.
func applyAttractionRequest(target *tourismmodel.Attraction, req AttractionRequest) {
	target.NameZh = req.NameZh
	target.NameEn = req.NameEn
	target.Council = req.Council
	target.Category = req.Category
	target.Tags = nilSafeStringSlice(req.Tags)
	target.PriceRangeMin = req.PriceRangeMin
	target.PriceRangeMax = req.PriceRangeMax
	target.TypicalDurationMinutes = req.TypicalDurationMinutes
	target.BestSeasons = nilSafeStringSlice(req.BestSeasons)
	target.Description = req.Description
	target.Source = req.Source
	target.SourceRef = req.SourceRef
}

// nilSafeStringSlice converts a nil slice to an empty one so pq.StringArray
// writes `{}` instead of NULL. The DDL has NOT NULL DEFAULT '{}' for these
// columns; sending NULL would 500.
func nilSafeStringSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func (h *AdminHandler) CreateAttraction(c *gin.Context) {
	var req AttractionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	row := &tourismmodel.Attraction{}
	applyAttractionRequest(row, req)
	row.IsActive = defaultActiveOnCreate(req.IsActive)
	if row.Source == "" {
		row.Source = tourismmodel.SourceAdminManual
	}
	if err := h.store.CreateAttraction(c.Request.Context(), row); err != nil {
		response.ServerError(c, "Failed to create attraction: "+err.Error())
		return
	}
	response.Created(c, row)
}

func (h *AdminHandler) UpdateAttraction(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := h.store.GetAttraction(c.Request.Context(), id)
	if err != nil {
		writeStoreError(c, err)
		return
	}
	var req AttractionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	applyAttractionRequest(row, req)
	if req.IsActive != nil {
		row.IsActive = *req.IsActive
	}
	if err := h.store.UpdateAttraction(c.Request.Context(), row); err != nil {
		response.ServerError(c, "Failed to update attraction: "+err.Error())
		return
	}
	response.Success(c, row)
}

func (h *AdminHandler) DeleteAttraction(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	if err := h.store.DeleteAttraction(c.Request.Context(), id); err != nil {
		writeStoreError(c, err)
		return
	}
	response.SuccessMessage(c, "Attraction deleted")
}

// defaultActiveOnCreate: admins entering data via this UI are trusted —
// default IsActive=true so the row is searchable immediately. Only the cold-
// start ETL path defaults to false (and that path bypasses this handler).
func defaultActiveOnCreate(explicit *bool) bool {
	if explicit != nil {
		return *explicit
	}
	return true
}

// ============================================================================
// Accommodations
// ============================================================================

type AccommodationRequest struct {
	NameZh        string   `json:"name_zh" binding:"required"`
	NameEn        string   `json:"name_en"`
	Council       string   `json:"council"`
	StarRating    *int16   `json:"star_rating"`
	PriceRangeMin *float64 `json:"price_range_min"`
	PriceRangeMax *float64 `json:"price_range_max"`
	RoomTypes     []string `json:"room_types"`
	Features      []string `json:"features"`
	Address       string   `json:"address"`
	Source        string   `json:"source"`
	SourceRef     string   `json:"source_ref"`
	IsActive      *bool    `json:"is_active"`
}

func (h *AdminHandler) ListAccommodations(c *gin.Context) {
	f := tourismstore.AccommodationFilter{
		Council:  c.Query("council"),
		Keywords: c.Query("keywords"),
		IsActive: parseBoolQuery(c, "is_active"),
		Page:     parseIntQuery(c, "page"),
		PageSize: parseIntQuery(c, "page_size"),
	}
	rows, total, err := h.store.ListAccommodations(c.Request.Context(), f)
	if err != nil {
		response.ServerError(c, "Failed to list accommodations: "+err.Error())
		return
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}
	pageSize := f.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	response.Paginated(c, rows, total, page, pageSize)
}

func (h *AdminHandler) GetAccommodation(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := h.store.GetAccommodation(c.Request.Context(), id)
	if err != nil {
		writeStoreError(c, err)
		return
	}
	response.Success(c, row)
}

func applyAccommodationRequest(target *tourismmodel.Accommodation, req AccommodationRequest) {
	target.NameZh = req.NameZh
	target.NameEn = req.NameEn
	target.Council = req.Council
	target.StarRating = req.StarRating
	target.PriceRangeMin = req.PriceRangeMin
	target.PriceRangeMax = req.PriceRangeMax
	target.RoomTypes = nilSafeStringSlice(req.RoomTypes)
	target.Features = nilSafeStringSlice(req.Features)
	target.Address = req.Address
	target.Source = req.Source
	target.SourceRef = req.SourceRef
}

func (h *AdminHandler) CreateAccommodation(c *gin.Context) {
	var req AccommodationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	row := &tourismmodel.Accommodation{}
	applyAccommodationRequest(row, req)
	row.IsActive = defaultActiveOnCreate(req.IsActive)
	if row.Source == "" {
		row.Source = tourismmodel.SourceAdminManual
	}
	if err := h.store.CreateAccommodation(c.Request.Context(), row); err != nil {
		response.ServerError(c, "Failed to create accommodation: "+err.Error())
		return
	}
	response.Created(c, row)
}

func (h *AdminHandler) UpdateAccommodation(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := h.store.GetAccommodation(c.Request.Context(), id)
	if err != nil {
		writeStoreError(c, err)
		return
	}
	var req AccommodationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	applyAccommodationRequest(row, req)
	if req.IsActive != nil {
		row.IsActive = *req.IsActive
	}
	if err := h.store.UpdateAccommodation(c.Request.Context(), row); err != nil {
		response.ServerError(c, "Failed to update accommodation: "+err.Error())
		return
	}
	response.Success(c, row)
}

func (h *AdminHandler) DeleteAccommodation(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	if err := h.store.DeleteAccommodation(c.Request.Context(), id); err != nil {
		writeStoreError(c, err)
		return
	}
	response.SuccessMessage(c, "Accommodation deleted")
}

// ============================================================================
// Food
// ============================================================================

type FoodRequest struct {
	NameZh          string   `json:"name_zh" binding:"required"`
	NameEn          string   `json:"name_en"`
	Council         string   `json:"council"`
	Cuisine         string   `json:"cuisine"`
	PriceRangeMin   *float64 `json:"price_range_min"`
	PriceRangeMax   *float64 `json:"price_range_max"`
	SignatureDishes []string `json:"signature_dishes"`
	Address         string   `json:"address"`
	Source          string   `json:"source"`
	SourceRef       string   `json:"source_ref"`
	IsActive        *bool    `json:"is_active"`
}

func (h *AdminHandler) ListFood(c *gin.Context) {
	f := tourismstore.FoodFilter{
		Council:  c.Query("council"),
		Cuisine:  c.Query("cuisine"),
		Keywords: c.Query("keywords"),
		IsActive: parseBoolQuery(c, "is_active"),
		Page:     parseIntQuery(c, "page"),
		PageSize: parseIntQuery(c, "page_size"),
	}
	rows, total, err := h.store.ListFood(c.Request.Context(), f)
	if err != nil {
		response.ServerError(c, "Failed to list food: "+err.Error())
		return
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}
	pageSize := f.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	response.Paginated(c, rows, total, page, pageSize)
}

func (h *AdminHandler) GetFood(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := h.store.GetFood(c.Request.Context(), id)
	if err != nil {
		writeStoreError(c, err)
		return
	}
	response.Success(c, row)
}

func applyFoodRequest(target *tourismmodel.Food, req FoodRequest) {
	target.NameZh = req.NameZh
	target.NameEn = req.NameEn
	target.Council = req.Council
	target.Cuisine = req.Cuisine
	target.PriceRangeMin = req.PriceRangeMin
	target.PriceRangeMax = req.PriceRangeMax
	target.SignatureDishes = nilSafeStringSlice(req.SignatureDishes)
	target.Address = req.Address
	target.Source = req.Source
	target.SourceRef = req.SourceRef
}

func (h *AdminHandler) CreateFood(c *gin.Context) {
	var req FoodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	row := &tourismmodel.Food{}
	applyFoodRequest(row, req)
	row.IsActive = defaultActiveOnCreate(req.IsActive)
	if row.Source == "" {
		row.Source = tourismmodel.SourceAdminManual
	}
	if err := h.store.CreateFood(c.Request.Context(), row); err != nil {
		response.ServerError(c, "Failed to create food: "+err.Error())
		return
	}
	response.Created(c, row)
}

func (h *AdminHandler) UpdateFood(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := h.store.GetFood(c.Request.Context(), id)
	if err != nil {
		writeStoreError(c, err)
		return
	}
	var req FoodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	applyFoodRequest(row, req)
	if req.IsActive != nil {
		row.IsActive = *req.IsActive
	}
	if err := h.store.UpdateFood(c.Request.Context(), row); err != nil {
		response.ServerError(c, "Failed to update food: "+err.Error())
		return
	}
	response.Success(c, row)
}

func (h *AdminHandler) DeleteFood(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	if err := h.store.DeleteFood(c.Request.Context(), id); err != nil {
		writeStoreError(c, err)
		return
	}
	response.SuccessMessage(c, "Food deleted")
}

// ============================================================================
// Experiences
// ============================================================================

type ExperienceRequest struct {
	NameZh                 string   `json:"name_zh" binding:"required"`
	NameEn                 string   `json:"name_en"`
	Council                string   `json:"council"`
	Category               string   `json:"category"`
	PriceRangeMin          *float64 `json:"price_range_min"`
	PriceRangeMax          *float64 `json:"price_range_max"`
	TypicalDurationMinutes *int     `json:"typical_duration_minutes"`
	BestSeasons            []string `json:"best_seasons"`
	Description            string   `json:"description"`
	Source                 string   `json:"source"`
	SourceRef              string   `json:"source_ref"`
	IsActive               *bool    `json:"is_active"`
}

func (h *AdminHandler) ListExperiences(c *gin.Context) {
	f := tourismstore.ExperienceFilter{
		Council:  c.Query("council"),
		Category: c.Query("category"),
		Keywords: c.Query("keywords"),
		IsActive: parseBoolQuery(c, "is_active"),
		Page:     parseIntQuery(c, "page"),
		PageSize: parseIntQuery(c, "page_size"),
	}
	rows, total, err := h.store.ListExperiences(c.Request.Context(), f)
	if err != nil {
		response.ServerError(c, "Failed to list experiences: "+err.Error())
		return
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}
	pageSize := f.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	response.Paginated(c, rows, total, page, pageSize)
}

func (h *AdminHandler) GetExperience(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := h.store.GetExperience(c.Request.Context(), id)
	if err != nil {
		writeStoreError(c, err)
		return
	}
	response.Success(c, row)
}

func applyExperienceRequest(target *tourismmodel.Experience, req ExperienceRequest) {
	target.NameZh = req.NameZh
	target.NameEn = req.NameEn
	target.Council = req.Council
	target.Category = req.Category
	target.PriceRangeMin = req.PriceRangeMin
	target.PriceRangeMax = req.PriceRangeMax
	target.TypicalDurationMinutes = req.TypicalDurationMinutes
	target.BestSeasons = nilSafeStringSlice(req.BestSeasons)
	target.Description = req.Description
	target.Source = req.Source
	target.SourceRef = req.SourceRef
}

func (h *AdminHandler) CreateExperience(c *gin.Context) {
	var req ExperienceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	row := &tourismmodel.Experience{}
	applyExperienceRequest(row, req)
	row.IsActive = defaultActiveOnCreate(req.IsActive)
	if row.Source == "" {
		row.Source = tourismmodel.SourceAdminManual
	}
	if err := h.store.CreateExperience(c.Request.Context(), row); err != nil {
		response.ServerError(c, "Failed to create experience: "+err.Error())
		return
	}
	response.Created(c, row)
}

func (h *AdminHandler) UpdateExperience(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := h.store.GetExperience(c.Request.Context(), id)
	if err != nil {
		writeStoreError(c, err)
		return
	}
	var req ExperienceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	applyExperienceRequest(row, req)
	if req.IsActive != nil {
		row.IsActive = *req.IsActive
	}
	if err := h.store.UpdateExperience(c.Request.Context(), row); err != nil {
		response.ServerError(c, "Failed to update experience: "+err.Error())
		return
	}
	response.Success(c, row)
}

func (h *AdminHandler) DeleteExperience(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	if err := h.store.DeleteExperience(c.Request.Context(), id); err != nil {
		writeStoreError(c, err)
		return
	}
	response.SuccessMessage(c, "Experience deleted")
}

// ============================================================================
// Pricing benchmarks
// ============================================================================

type PricingBenchmarkRequest struct {
	Category       string   `json:"category" binding:"required"`
	Council        string   `json:"council" binding:"required"`
	DurationBucket string   `json:"duration_bucket" binding:"required"`
	Season         string   `json:"season"`
	MedianPrice    *float64 `json:"median_price"`
	P25            *float64 `json:"p25"`
	P75            *float64 `json:"p75"`
	SampleSize     int      `json:"sample_size"`
	Currency       string   `json:"currency"`
}

// validateDurationBucket guards the pricing-benchmark UNIQUE dimension. We
// reject unknown buckets early so the row never gets a value the agent's
// SuggestPricing path can't query (D4 — buckets feed the confidence math).
func validateDurationBucket(bucket string) bool {
	switch bucket {
	case tourismmodel.DurationBucketHalfDay,
		tourismmodel.DurationBucketFullDay,
		tourismmodel.DurationBucketMultiDay:
		return true
	default:
		return false
	}
}

func validateSeason(season string) bool {
	switch season {
	case "",
		tourismmodel.SeasonYearRound,
		tourismmodel.SeasonSpring,
		tourismmodel.SeasonSummer,
		tourismmodel.SeasonAutumn,
		tourismmodel.SeasonWinter:
		return true
	default:
		return false
	}
}

func (h *AdminHandler) ListPricingBenchmarks(c *gin.Context) {
	f := tourismstore.PricingBenchmarkFilter{
		Category:       c.Query("category"),
		Council:        c.Query("council"),
		DurationBucket: c.Query("duration_bucket"),
		Season:         c.Query("season"),
		Page:           parseIntQuery(c, "page"),
		PageSize:       parseIntQuery(c, "page_size"),
	}
	rows, total, err := h.store.ListPricingBenchmarks(c.Request.Context(), f)
	if err != nil {
		response.ServerError(c, "Failed to list pricing benchmarks: "+err.Error())
		return
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}
	pageSize := f.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	response.Paginated(c, rows, total, page, pageSize)
}

func (h *AdminHandler) GetPricingBenchmark(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := h.store.GetPricingBenchmark(c.Request.Context(), id)
	if err != nil {
		writeStoreError(c, err)
		return
	}
	response.Success(c, row)
}

// applyPricingBenchmarkRequest copies request → model. Season default
// (year_round) is applied here rather than in the store so the UNIQUE
// lookup key is stable across create / update paths.
func applyPricingBenchmarkRequest(target *tourismmodel.PricingBenchmark, req PricingBenchmarkRequest) {
	target.Category = req.Category
	target.Council = req.Council
	target.DurationBucket = req.DurationBucket
	if req.Season == "" {
		target.Season = tourismmodel.SeasonYearRound
	} else {
		target.Season = req.Season
	}
	target.MedianPrice = req.MedianPrice
	target.P25 = req.P25
	target.P75 = req.P75
	target.SampleSize = req.SampleSize
	if req.Currency == "" {
		target.Currency = "AUD"
	} else {
		target.Currency = req.Currency
	}
}

func (h *AdminHandler) CreatePricingBenchmark(c *gin.Context) {
	var req PricingBenchmarkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	if !validateDurationBucket(req.DurationBucket) {
		response.BadRequest(c, "Invalid duration_bucket (must be half_day | full_day | multi_day)")
		return
	}
	if !validateSeason(req.Season) {
		response.BadRequest(c, "Invalid season (must be year_round | spring | summer | autumn | winter)")
		return
	}
	row := &tourismmodel.PricingBenchmark{}
	applyPricingBenchmarkRequest(row, req)
	if err := h.store.CreatePricingBenchmark(c.Request.Context(), row); err != nil {
		writeStoreError(c, err)
		return
	}
	response.Created(c, row)
}

func (h *AdminHandler) UpdatePricingBenchmark(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := h.store.GetPricingBenchmark(c.Request.Context(), id)
	if err != nil {
		writeStoreError(c, err)
		return
	}
	var req PricingBenchmarkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	if !validateDurationBucket(req.DurationBucket) {
		response.BadRequest(c, "Invalid duration_bucket (must be half_day | full_day | multi_day)")
		return
	}
	if !validateSeason(req.Season) {
		response.BadRequest(c, "Invalid season (must be year_round | spring | summer | autumn | winter)")
		return
	}
	applyPricingBenchmarkRequest(row, req)
	if err := h.store.UpdatePricingBenchmark(c.Request.Context(), row); err != nil {
		writeStoreError(c, err)
		return
	}
	response.Success(c, row)
}

func (h *AdminHandler) DeletePricingBenchmark(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	if err := h.store.DeletePricingBenchmark(c.Request.Context(), id); err != nil {
		writeStoreError(c, err)
		return
	}
	response.SuccessMessage(c, "Pricing benchmark deleted")
}
