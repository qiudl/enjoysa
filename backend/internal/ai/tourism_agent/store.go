package tourism_agent

import (
	"context"
	"errors"

	tourismmodel "enjoysa-backend/internal/tourism/model"
	"gorm.io/gorm"
)

// REQ-20260510-0002 · 1B
//
// Store wraps DB access for the tourism knowledge base. The interface is
// narrow on purpose so tests can use a fake without spinning up Postgres.
//
// `gormStore` reads only `is_active = TRUE` rows by default — D2 decision:
// cold-start ETL entries are admin-gated before they show up in tool results.

// SearchParams selects entries across the four knowledge tables.
type SearchParams struct {
	Category string // optional — applied to attractions/experiences
	Council  string // optional
	Keywords string // optional ILIKE
	Limit    int    // 0 → defaults to 10
}

// SearchHit is a unified shape returned for any of the four entity tables.
type SearchHit struct {
	Type          string   `json:"type"` // attraction | accommodation | food | experience
	ID            uint     `json:"id"`
	NameZh        string   `json:"name_zh"`
	NameEn        string   `json:"name_en,omitempty"`
	Council       string   `json:"council,omitempty"`
	Category      string   `json:"category,omitempty"`
	Description   string   `json:"description,omitempty"`
	PriceRangeMin *float64 `json:"price_range_min,omitempty"`
	PriceRangeMax *float64 `json:"price_range_max,omitempty"`
}

// PricingParams keys a row in tourism_pricing_benchmarks.
type PricingParams struct {
	Category       string
	Council        string
	DurationBucket string
	Season         string // empty → year_round
}

// SimilarProductSkeleton intentionally omits Name/Description so the LLM
// does not regurgitate existing supplier copy verbatim (D3 spirit).
// 1F will wire a real product-store implementation; 1B ships a stub.
type SimilarProductSkeleton struct {
	ID             uint    `json:"id"`
	Category       string  `json:"category,omitempty"`
	Council        string  `json:"council,omitempty"`
	DurationBucket string  `json:"duration_bucket,omitempty"`
	Price          float64 `json:"price"`
}

// Store is the narrow set of DB operations the agent needs.
type Store interface {
	SearchKnowledge(ctx context.Context, p SearchParams) ([]SearchHit, error)
	GetPricingBenchmark(ctx context.Context, p PricingParams) (*tourismmodel.PricingBenchmark, error)
	GetSimilarProducts(ctx context.Context, p PricingParams) ([]SimilarProductSkeleton, error)
}

// NewGORMStore builds a Store backed by Postgres via GORM.
func NewGORMStore(db *gorm.DB) Store {
	return &gormStore{db: db}
}

type gormStore struct {
	db *gorm.DB
}

const defaultSearchLimit = 10

func (s *gormStore) SearchKnowledge(ctx context.Context, p SearchParams) ([]SearchHit, error) {
	limit := p.Limit
	if limit <= 0 {
		limit = defaultSearchLimit
	}
	hits := make([]SearchHit, 0, limit)

	// Attractions
	{
		var rows []tourismmodel.Attraction
		q := s.db.WithContext(ctx).Where("is_active = ?", true)
		if p.Category != "" {
			q = q.Where("category = ?", p.Category)
		}
		if p.Council != "" {
			q = q.Where("council = ?", p.Council)
		}
		if p.Keywords != "" {
			like := "%" + p.Keywords + "%"
			q = q.Where("name_zh ILIKE ? OR name_en ILIKE ? OR description ILIKE ?", like, like, like)
		}
		if err := q.Limit(limit).Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, r := range rows {
			hits = append(hits, SearchHit{
				Type: "attraction", ID: r.ID,
				NameZh: r.NameZh, NameEn: r.NameEn,
				Council: r.Council, Category: r.Category,
				Description:   r.Description,
				PriceRangeMin: r.PriceRangeMin,
				PriceRangeMax: r.PriceRangeMax,
			})
		}
	}

	// Experiences
	if remaining := limit - len(hits); remaining > 0 {
		var rows []tourismmodel.Experience
		q := s.db.WithContext(ctx).Where("is_active = ?", true)
		if p.Category != "" {
			q = q.Where("category = ?", p.Category)
		}
		if p.Council != "" {
			q = q.Where("council = ?", p.Council)
		}
		if p.Keywords != "" {
			like := "%" + p.Keywords + "%"
			q = q.Where("name_zh ILIKE ? OR name_en ILIKE ? OR description ILIKE ?", like, like, like)
		}
		if err := q.Limit(remaining).Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, r := range rows {
			hits = append(hits, SearchHit{
				Type: "experience", ID: r.ID,
				NameZh: r.NameZh, NameEn: r.NameEn,
				Council: r.Council, Category: r.Category,
				Description:   r.Description,
				PriceRangeMin: r.PriceRangeMin,
				PriceRangeMax: r.PriceRangeMax,
			})
		}
	}

	// Food
	if remaining := limit - len(hits); remaining > 0 {
		var rows []tourismmodel.Food
		q := s.db.WithContext(ctx).Where("is_active = ?", true)
		if p.Council != "" {
			q = q.Where("council = ?", p.Council)
		}
		if p.Keywords != "" {
			like := "%" + p.Keywords + "%"
			q = q.Where("name_zh ILIKE ? OR name_en ILIKE ?", like, like)
		}
		if err := q.Limit(remaining).Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, r := range rows {
			hits = append(hits, SearchHit{
				Type: "food", ID: r.ID,
				NameZh: r.NameZh, NameEn: r.NameEn,
				Council:       r.Council,
				PriceRangeMin: r.PriceRangeMin,
				PriceRangeMax: r.PriceRangeMax,
			})
		}
	}

	// Accommodations
	if remaining := limit - len(hits); remaining > 0 {
		var rows []tourismmodel.Accommodation
		q := s.db.WithContext(ctx).Where("is_active = ?", true)
		if p.Council != "" {
			q = q.Where("council = ?", p.Council)
		}
		if p.Keywords != "" {
			like := "%" + p.Keywords + "%"
			q = q.Where("name_zh ILIKE ? OR name_en ILIKE ?", like, like)
		}
		if err := q.Limit(remaining).Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, r := range rows {
			hits = append(hits, SearchHit{
				Type: "accommodation", ID: r.ID,
				NameZh: r.NameZh, NameEn: r.NameEn,
				Council:       r.Council,
				PriceRangeMin: r.PriceRangeMin,
				PriceRangeMax: r.PriceRangeMax,
			})
		}
	}

	return hits, nil
}

func (s *gormStore) GetPricingBenchmark(ctx context.Context, p PricingParams) (*tourismmodel.PricingBenchmark, error) {
	season := p.Season
	if season == "" {
		season = tourismmodel.SeasonYearRound
	}

	var bench tourismmodel.PricingBenchmark
	err := s.db.WithContext(ctx).
		Where("category = ? AND council = ? AND duration_bucket = ? AND season = ?",
			p.Category, p.Council, p.DurationBucket, season).
		First(&bench).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Return a zero-sample placeholder so the caller can branch on
		// SampleSize == 0 without a separate not-found code path.
		return &tourismmodel.PricingBenchmark{
			Category:       p.Category,
			Council:        p.Council,
			DurationBucket: p.DurationBucket,
			Season:         season,
			Currency:       "AUD",
			SampleSize:     0,
		}, nil
	}
	if err != nil {
		return nil, err
	}
	return &bench, nil
}

// GetSimilarProducts is stubbed in 1B — returning empty avoids a cross-domain
// dep on the product package while the agent loop / tool wiring is shaped.
// 1F (产品编辑页 AI 生成嵌入) replaces this with a real product-store query
// that returns up to 5 active product skeletons matching the dimensions.
func (s *gormStore) GetSimilarProducts(ctx context.Context, p PricingParams) ([]SimilarProductSkeleton, error) {
	return []SimilarProductSkeleton{}, nil
}
