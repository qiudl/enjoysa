// Package scraper holds the admin-triggered scrape pipeline for the
// tourism knowledge base.
//
// REQ-20260510-0011 · Phase 2 · 2C
//
// Tables `tourism_scrape_jobs` + `tourism_scrape_staging` are NOT in
// cmd/server/main.go autoMigrate (D7) — apply 012_tourism_scrape.sql via
// SSH after deploy.
package scraper

import (
	"time"

	"gorm.io/datatypes"
)

// JobStatus values mirror the CHECK-less VARCHAR in 012 SQL. Strings (not
// iota constants) so the wire format stays human-readable in REST responses
// and DB rows side-by-side.
const (
	JobStatusQueued    = "queued"
	JobStatusRunning   = "running"
	JobStatusCompleted = "completed"
	JobStatusFailed    = "failed"
	JobStatusPartial   = "partial" // some URLs failed but the run finished
)

// Job is one admin-triggered scrape run.
type Job struct {
	ID             string    `gorm:"primaryKey;size:50" json:"id"` // uuid
	Source         string    `gorm:"size:50;not null" json:"source"`
	Status         string    `gorm:"size:20;not null;default:queued" json:"status"`
	TotalURLs      int       `gorm:"not null;default:0" json:"total_urls"`
	ScrapedURLs    int       `gorm:"not null;default:0" json:"scraped_urls"`
	ExtractedRows  int       `gorm:"not null;default:0" json:"extracted_rows"`
	SkippedRows    int       `gorm:"not null;default:0" json:"skipped_rows"`
	ErrorCount     int       `gorm:"not null;default:0" json:"error_count"`
	LastError      string    `gorm:"type:text" json:"last_error,omitempty"`
	TriggeredBy    *uint     `json:"triggered_by,omitempty"`
	StartedAt      *time.Time `json:"started_at,omitempty"`
	FinishedAt     *time.Time `json:"finished_at,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

func (Job) TableName() string { return "tourism_scrape_jobs" }

// StagingStatus values mirror 012 SQL.
const (
	StagingStatusPending  = "pending"
	StagingStatusPromoted = "promoted"
	StagingStatusRejected = "rejected"
)

// Staging is one LLM-extracted candidate awaiting admin review. Promoted →
// becomes a tourism_attractions row; rejected → kept for audit.
type Staging struct {
	ID                    uint           `gorm:"primaryKey" json:"id"`
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
	Source                string         `gorm:"size:50;not null;uniqueIndex:uq_tourism_scrape_staging_url,priority:1" json:"source"`
	SourceURL             string         `gorm:"type:text;not null;uniqueIndex:uq_tourism_scrape_staging_url,priority:2" json:"source_url"`
	RawHTMLExcerpt        string         `gorm:"type:text" json:"raw_html_excerpt,omitempty"`
	ExtractedPayload      datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"extracted_payload"`
	ExtractionConfidence  string         `gorm:"size:10" json:"extraction_confidence,omitempty"`
	Status                string         `gorm:"size:20;not null;default:pending;index" json:"status"`
	ReviewedBy            *uint          `json:"reviewed_by,omitempty"`
	ReviewedAt            *time.Time     `json:"reviewed_at,omitempty"`
	RejectReason          string         `gorm:"type:text" json:"reject_reason,omitempty"`
	PromotedToID          *uint          `json:"promoted_to_id,omitempty"`
	ScrapeJobID           string         `gorm:"size:50;not null;index" json:"scrape_job_id"`
}

func (Staging) TableName() string { return "tourism_scrape_staging" }

// SourceSATourism is the only source supported in Phase 2. Wikipedia and
// TripAdvisor were ruled out in design (R5: Wikipedia CC-BY-SA attribution
// chain too messy for v1; TripAdvisor ToS bans scraping).
const SourceSATourism = "sa-tourism"
