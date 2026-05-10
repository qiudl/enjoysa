// Package store backs the admin CRUD layer for the tourism knowledge base.
//
// REQ-20260510-0002 · 南澳旅游 AI Agent · Phase 1 · 1C
//
// AdminStore wraps DB access for the 5 knowledge tables (attractions,
// accommodations, food, experiences, pricing_benchmarks). It is separate
// from the agent's read-only Store (internal/ai/tourism_agent/store.go) on
// purpose: the agent only ever reads is_active=true rows, while admin CRUD
// must be able to read drafts and toggle the gate.
package store

import (
	"context"
	"errors"

	tourismmodel "enjoysa-backend/internal/tourism/model"

	"gorm.io/gorm"
)

// AdminStore is the admin-facing CRUD wrapper. Methods accept a context and
// return GORM errors verbatim so the handler can map gorm.ErrRecordNotFound
// to 404 and everything else to 500.
type AdminStore struct {
	db *gorm.DB
}

func NewAdminStore(db *gorm.DB) *AdminStore {
	return &AdminStore{db: db}
}

// pageOffset clamps page/pageSize and returns (offset, pageSize).
// Centralising the clamp keeps the handler free of magic numbers and stops
// a malicious large pageSize from blowing up the DB.
const (
	maxPageSize     = 100
	defaultPageSize = 20
)

func pageOffset(page, pageSize int) (int, int) {
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	if page <= 0 {
		page = 1
	}
	return (page - 1) * pageSize, pageSize
}

// ============================================================================
// Attractions
// ============================================================================

// AttractionFilter narrows the list query. Empty fields mean no filter on
// that dimension. IsActive is *bool so callers can distinguish "show only
// active", "show only inactive", and "show both".
type AttractionFilter struct {
	Council  string
	Category string
	Keywords string
	IsActive *bool
	Page     int
	PageSize int
}

func (s *AdminStore) ListAttractions(ctx context.Context, f AttractionFilter) ([]tourismmodel.Attraction, int64, error) {
	q := s.db.WithContext(ctx).Model(&tourismmodel.Attraction{})
	q = applyAttractionFilter(q, f)

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset, pageSize := pageOffset(f.Page, f.PageSize)
	var rows []tourismmodel.Attraction
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func applyAttractionFilter(q *gorm.DB, f AttractionFilter) *gorm.DB {
	if f.Council != "" {
		q = q.Where("council = ?", f.Council)
	}
	if f.Category != "" {
		q = q.Where("category = ?", f.Category)
	}
	if f.IsActive != nil {
		q = q.Where("is_active = ?", *f.IsActive)
	}
	if f.Keywords != "" {
		like := "%" + f.Keywords + "%"
		q = q.Where("name_zh ILIKE ? OR name_en ILIKE ? OR description ILIKE ?", like, like, like)
	}
	return q
}

func (s *AdminStore) GetAttraction(ctx context.Context, id uint) (*tourismmodel.Attraction, error) {
	var row tourismmodel.Attraction
	if err := s.db.WithContext(ctx).First(&row, id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *AdminStore) CreateAttraction(ctx context.Context, a *tourismmodel.Attraction) error {
	return s.db.WithContext(ctx).Create(a).Error
}

func (s *AdminStore) UpdateAttraction(ctx context.Context, a *tourismmodel.Attraction) error {
	// Use Save so all fields, including zero-valued ones (empty arrays,
	// nil pointers), are written back. Updates() with a struct would skip
	// zero-valued fields, breaking PUT semantics.
	return s.db.WithContext(ctx).Save(a).Error
}

func (s *AdminStore) DeleteAttraction(ctx context.Context, id uint) error {
	res := s.db.WithContext(ctx).Delete(&tourismmodel.Attraction{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ============================================================================
// Accommodations
// ============================================================================

type AccommodationFilter struct {
	Council  string
	Keywords string
	IsActive *bool
	Page     int
	PageSize int
}

func (s *AdminStore) ListAccommodations(ctx context.Context, f AccommodationFilter) ([]tourismmodel.Accommodation, int64, error) {
	q := s.db.WithContext(ctx).Model(&tourismmodel.Accommodation{})
	if f.Council != "" {
		q = q.Where("council = ?", f.Council)
	}
	if f.IsActive != nil {
		q = q.Where("is_active = ?", *f.IsActive)
	}
	if f.Keywords != "" {
		like := "%" + f.Keywords + "%"
		q = q.Where("name_zh ILIKE ? OR name_en ILIKE ?", like, like)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset, pageSize := pageOffset(f.Page, f.PageSize)
	var rows []tourismmodel.Accommodation
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *AdminStore) GetAccommodation(ctx context.Context, id uint) (*tourismmodel.Accommodation, error) {
	var row tourismmodel.Accommodation
	if err := s.db.WithContext(ctx).First(&row, id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *AdminStore) CreateAccommodation(ctx context.Context, a *tourismmodel.Accommodation) error {
	return s.db.WithContext(ctx).Create(a).Error
}

func (s *AdminStore) UpdateAccommodation(ctx context.Context, a *tourismmodel.Accommodation) error {
	return s.db.WithContext(ctx).Save(a).Error
}

func (s *AdminStore) DeleteAccommodation(ctx context.Context, id uint) error {
	res := s.db.WithContext(ctx).Delete(&tourismmodel.Accommodation{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ============================================================================
// Food
// ============================================================================

type FoodFilter struct {
	Council  string
	Cuisine  string
	Keywords string
	IsActive *bool
	Page     int
	PageSize int
}

func (s *AdminStore) ListFood(ctx context.Context, f FoodFilter) ([]tourismmodel.Food, int64, error) {
	q := s.db.WithContext(ctx).Model(&tourismmodel.Food{})
	if f.Council != "" {
		q = q.Where("council = ?", f.Council)
	}
	if f.Cuisine != "" {
		q = q.Where("cuisine = ?", f.Cuisine)
	}
	if f.IsActive != nil {
		q = q.Where("is_active = ?", *f.IsActive)
	}
	if f.Keywords != "" {
		like := "%" + f.Keywords + "%"
		q = q.Where("name_zh ILIKE ? OR name_en ILIKE ?", like, like)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset, pageSize := pageOffset(f.Page, f.PageSize)
	var rows []tourismmodel.Food
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *AdminStore) GetFood(ctx context.Context, id uint) (*tourismmodel.Food, error) {
	var row tourismmodel.Food
	if err := s.db.WithContext(ctx).First(&row, id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *AdminStore) CreateFood(ctx context.Context, a *tourismmodel.Food) error {
	return s.db.WithContext(ctx).Create(a).Error
}

func (s *AdminStore) UpdateFood(ctx context.Context, a *tourismmodel.Food) error {
	return s.db.WithContext(ctx).Save(a).Error
}

func (s *AdminStore) DeleteFood(ctx context.Context, id uint) error {
	res := s.db.WithContext(ctx).Delete(&tourismmodel.Food{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ============================================================================
// Experiences
// ============================================================================

type ExperienceFilter struct {
	Council  string
	Category string
	Keywords string
	IsActive *bool
	Page     int
	PageSize int
}

func (s *AdminStore) ListExperiences(ctx context.Context, f ExperienceFilter) ([]tourismmodel.Experience, int64, error) {
	q := s.db.WithContext(ctx).Model(&tourismmodel.Experience{})
	if f.Council != "" {
		q = q.Where("council = ?", f.Council)
	}
	if f.Category != "" {
		q = q.Where("category = ?", f.Category)
	}
	if f.IsActive != nil {
		q = q.Where("is_active = ?", *f.IsActive)
	}
	if f.Keywords != "" {
		like := "%" + f.Keywords + "%"
		q = q.Where("name_zh ILIKE ? OR name_en ILIKE ? OR description ILIKE ?", like, like, like)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset, pageSize := pageOffset(f.Page, f.PageSize)
	var rows []tourismmodel.Experience
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *AdminStore) GetExperience(ctx context.Context, id uint) (*tourismmodel.Experience, error) {
	var row tourismmodel.Experience
	if err := s.db.WithContext(ctx).First(&row, id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *AdminStore) CreateExperience(ctx context.Context, a *tourismmodel.Experience) error {
	return s.db.WithContext(ctx).Create(a).Error
}

func (s *AdminStore) UpdateExperience(ctx context.Context, a *tourismmodel.Experience) error {
	return s.db.WithContext(ctx).Save(a).Error
}

func (s *AdminStore) DeleteExperience(ctx context.Context, id uint) error {
	res := s.db.WithContext(ctx).Delete(&tourismmodel.Experience{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ============================================================================
// Pricing benchmarks (no soft delete; UNIQUE(category,council,duration_bucket,season))
// ============================================================================

type PricingBenchmarkFilter struct {
	Category       string
	Council        string
	DurationBucket string
	Season         string
	Page           int
	PageSize       int
}

func (s *AdminStore) ListPricingBenchmarks(ctx context.Context, f PricingBenchmarkFilter) ([]tourismmodel.PricingBenchmark, int64, error) {
	q := s.db.WithContext(ctx).Model(&tourismmodel.PricingBenchmark{})
	if f.Category != "" {
		q = q.Where("category = ?", f.Category)
	}
	if f.Council != "" {
		q = q.Where("council = ?", f.Council)
	}
	if f.DurationBucket != "" {
		q = q.Where("duration_bucket = ?", f.DurationBucket)
	}
	if f.Season != "" {
		q = q.Where("season = ?", f.Season)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset, pageSize := pageOffset(f.Page, f.PageSize)
	var rows []tourismmodel.PricingBenchmark
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *AdminStore) GetPricingBenchmark(ctx context.Context, id uint) (*tourismmodel.PricingBenchmark, error) {
	var row tourismmodel.PricingBenchmark
	if err := s.db.WithContext(ctx).First(&row, id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *AdminStore) CreatePricingBenchmark(ctx context.Context, a *tourismmodel.PricingBenchmark) error {
	// Surfaces UNIQUE violation as ErrDuplicate so the handler can return 409
	// instead of leaking the raw pq error string.
	if err := s.db.WithContext(ctx).Create(a).Error; err != nil {
		if isUniqueViolation(err) {
			return ErrDuplicate
		}
		return err
	}
	return nil
}

func (s *AdminStore) UpdatePricingBenchmark(ctx context.Context, a *tourismmodel.PricingBenchmark) error {
	if err := s.db.WithContext(ctx).Save(a).Error; err != nil {
		if isUniqueViolation(err) {
			return ErrDuplicate
		}
		return err
	}
	return nil
}

func (s *AdminStore) DeletePricingBenchmark(ctx context.Context, id uint) error {
	res := s.db.WithContext(ctx).Delete(&tourismmodel.PricingBenchmark{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ErrDuplicate is returned when the pricing-benchmark UNIQUE constraint
// (category, council, duration_bucket, season) trips. Surfacing this as a
// sentinel keeps the handler 409 path independent of the underlying driver.
var ErrDuplicate = errors.New("tourism: duplicate pricing benchmark dimensions")

// isUniqueViolation matches Postgres SQLSTATE 23505 from pgconn / pq error
// strings. We probe the message rather than the typed error so the store
// stays driver-agnostic for tests.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	// pq: "duplicate key value violates unique constraint"
	// pgx: "ERROR: duplicate key value violates unique constraint"
	for _, needle := range []string{"duplicate key value", "UNIQUE constraint failed", "23505"} {
		if containsFold(msg, needle) {
			return true
		}
	}
	return false
}

func containsFold(s, sub string) bool {
	if len(sub) > len(s) {
		return false
	}
	// Lowercase compare without strings.ToLower allocations on the hot path.
	for i := 0; i+len(sub) <= len(s); i++ {
		match := true
		for j := 0; j < len(sub); j++ {
			a, b := s[i+j], sub[j]
			if a >= 'A' && a <= 'Z' {
				a += 'a' - 'A'
			}
			if b >= 'A' && b <= 'Z' {
				b += 'a' - 'A'
			}
			if a != b {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}
