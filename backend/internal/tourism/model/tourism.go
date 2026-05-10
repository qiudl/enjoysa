// Package model holds the tourism knowledge base GORM entities.
//
// REQ-20260510-0002 · 南澳旅游 AI Agent · Phase 1
//
// 这些表不走 GORM AutoMigrate（D7 决议），仅靠 backend/migrations/011_tourism_knowledge_base.sql
// 及后续手写迁移维护。请勿在 cmd/server/main.go 的 autoMigrate 列表中添加它们。
package model

import (
	"time"

	"github.com/lib/pq"
	"gorm.io/gorm"
)

// Source 表示知识条目的数据来源，便于二期重抽取/清洗。
const (
	SourceProductETL  = "product_etl"
	SourceAdminManual = "admin_manual"
	SourceScraped     = "scraped"
)

// DurationBucket 价格行情聚合粒度。
const (
	DurationBucketHalfDay   = "half_day"
	DurationBucketFullDay   = "full_day"
	DurationBucketMultiDay  = "multi_day"
)

// Season 季节维度。
const (
	SeasonYearRound = "year_round"
	SeasonSpring    = "spring"
	SeasonSummer    = "summer"
	SeasonAutumn    = "autumn"
	SeasonWinter    = "winter"
)

// Attraction 景点
type Attraction struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	NameZh                 string         `gorm:"size:255;not null" json:"name_zh"`
	NameEn                 string         `gorm:"size:255" json:"name_en,omitempty"`
	Council                string         `gorm:"size:100;index" json:"council,omitempty"`
	Category               string         `gorm:"size:50;index" json:"category,omitempty"`
	Tags                   pq.StringArray `gorm:"type:text[];not null;default:'{}'" json:"tags"`
	PriceRangeMin          *float64       `gorm:"type:decimal(10,2)" json:"price_range_min,omitempty"`
	PriceRangeMax          *float64       `gorm:"type:decimal(10,2)" json:"price_range_max,omitempty"`
	TypicalDurationMinutes *int           `json:"typical_duration_minutes,omitempty"`
	BestSeasons            pq.StringArray `gorm:"type:text[];not null;default:'{}'" json:"best_seasons"`
	Description            string         `gorm:"type:text" json:"description,omitempty"`
	Source                 string         `gorm:"size:50" json:"source,omitempty"`
	SourceRef              string         `gorm:"size:255" json:"source_ref,omitempty"`
	// IsActive 默认 false：冷启动 ETL 入库的条目需 admin 审核启用后才纳入 search_knowledge。
	// admin 后台手动录入时 service 层显式置 true。
	IsActive bool `gorm:"not null;default:false;index" json:"is_active"`
}

func (Attraction) TableName() string { return "tourism_attractions" }

// Accommodation 酒店/民宿
type Accommodation struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	NameZh        string         `gorm:"size:255;not null" json:"name_zh"`
	NameEn        string         `gorm:"size:255" json:"name_en,omitempty"`
	Council       string         `gorm:"size:100;index" json:"council,omitempty"`
	StarRating    *int16         `json:"star_rating,omitempty"`
	PriceRangeMin *float64       `gorm:"type:decimal(10,2)" json:"price_range_min,omitempty"`
	PriceRangeMax *float64       `gorm:"type:decimal(10,2)" json:"price_range_max,omitempty"`
	RoomTypes     pq.StringArray `gorm:"type:text[];not null;default:'{}'" json:"room_types"`
	Features      pq.StringArray `gorm:"type:text[];not null;default:'{}'" json:"features"`
	Address       string         `gorm:"type:text" json:"address,omitempty"`
	Source        string         `gorm:"size:50" json:"source,omitempty"`
	SourceRef     string         `gorm:"size:255" json:"source_ref,omitempty"`
	IsActive      bool           `gorm:"not null;default:false;index" json:"is_active"`
}

func (Accommodation) TableName() string { return "tourism_accommodations" }

// Food 美食/餐厅
type Food struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	NameZh          string         `gorm:"size:255;not null" json:"name_zh"`
	NameEn          string         `gorm:"size:255" json:"name_en,omitempty"`
	Council         string         `gorm:"size:100;index" json:"council,omitempty"`
	Cuisine         string         `gorm:"size:50;index" json:"cuisine,omitempty"`
	PriceRangeMin   *float64       `gorm:"type:decimal(10,2)" json:"price_range_min,omitempty"`
	PriceRangeMax   *float64       `gorm:"type:decimal(10,2)" json:"price_range_max,omitempty"`
	SignatureDishes pq.StringArray `gorm:"type:text[];not null;default:'{}'" json:"signature_dishes"`
	Address         string         `gorm:"type:text" json:"address,omitempty"`
	Source          string         `gorm:"size:50" json:"source,omitempty"`
	SourceRef       string         `gorm:"size:255" json:"source_ref,omitempty"`
	IsActive        bool           `gorm:"not null;default:false;index" json:"is_active"`
}

func (Food) TableName() string { return "tourism_food" }

// Experience 体验型项目（红酒品鉴 / 野生动物 / 邮轮 / 徒步等）
type Experience struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	NameZh                 string         `gorm:"size:255;not null" json:"name_zh"`
	NameEn                 string         `gorm:"size:255" json:"name_en,omitempty"`
	Council                string         `gorm:"size:100;index" json:"council,omitempty"`
	Category               string         `gorm:"size:50;index" json:"category,omitempty"`
	PriceRangeMin          *float64       `gorm:"type:decimal(10,2)" json:"price_range_min,omitempty"`
	PriceRangeMax          *float64       `gorm:"type:decimal(10,2)" json:"price_range_max,omitempty"`
	TypicalDurationMinutes *int           `json:"typical_duration_minutes,omitempty"`
	BestSeasons            pq.StringArray `gorm:"type:text[];not null;default:'{}'" json:"best_seasons"`
	Description            string         `gorm:"type:text" json:"description,omitempty"`
	Source                 string         `gorm:"size:50" json:"source,omitempty"`
	SourceRef              string         `gorm:"size:255" json:"source_ref,omitempty"`
	IsActive               bool           `gorm:"not null;default:false;index" json:"is_active"`
}

func (Experience) TableName() string { return "tourism_experiences" }

// PricingBenchmark 价格行情（按品类 + Council + 时段聚合的中位/分位价）
type PricingBenchmark struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Category       string `gorm:"size:50;not null;uniqueIndex:uq_pricing_benchmarks_dim,priority:1" json:"category"`
	Council        string `gorm:"size:100;not null;uniqueIndex:uq_pricing_benchmarks_dim,priority:2" json:"council"`
	DurationBucket string `gorm:"size:20;not null;uniqueIndex:uq_pricing_benchmarks_dim,priority:3" json:"duration_bucket"`
	Season         string `gorm:"size:20;not null;default:year_round;uniqueIndex:uq_pricing_benchmarks_dim,priority:4" json:"season"`

	MedianPrice *float64   `gorm:"type:decimal(10,2)" json:"median_price,omitempty"`
	P25         *float64   `gorm:"type:decimal(10,2)" json:"p25,omitempty"`
	P75         *float64   `gorm:"type:decimal(10,2)" json:"p75,omitempty"`
	SampleSize  int        `gorm:"not null;default:0" json:"sample_size"`
	Currency    string     `gorm:"size:3;not null;default:AUD" json:"currency"`
	ComputedAt  *time.Time `json:"computed_at,omitempty"`
}

func (PricingBenchmark) TableName() string { return "tourism_pricing_benchmarks" }

// Confidence 由 sample_size 推导（不存表，调用方按 D4 决议输出）。
const (
	ConfidenceInsufficient = "insufficient" // < 3
	ConfidenceLow          = "low"          // 3-4
	ConfidenceNormal       = "normal"       // 5-11
	ConfidenceHigh         = "high"         // >= 12
)

// ConfidenceFor 按 sample_size 推导置信度档位。
func ConfidenceFor(sampleSize int) string {
	switch {
	case sampleSize < 3:
		return ConfidenceInsufficient
	case sampleSize < 5:
		return ConfidenceLow
	case sampleSize < 12:
		return ConfidenceNormal
	default:
		return ConfidenceHigh
	}
}
