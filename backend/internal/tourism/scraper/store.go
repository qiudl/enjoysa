package scraper

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
)

// Store wraps DB access for jobs + staging. Narrow on purpose so the
// scraper service layer stays testable with fakes.
type Store struct {
	db *gorm.DB
}

func NewStore(db *gorm.DB) *Store { return &Store{db: db} }

// ============================================================================
// Jobs
// ============================================================================

func (s *Store) CreateJob(ctx context.Context, j *Job) error {
	return s.db.WithContext(ctx).Create(j).Error
}

func (s *Store) GetJob(ctx context.Context, id string) (*Job, error) {
	var j Job
	if err := s.db.WithContext(ctx).First(&j, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &j, nil
}

// StaleJobThreshold — runs older than this with status=running are treated
// as orphaned (process crashed mid-run, or HTTP request context cancelled
// the goroutine). Lets a new admin click bypass the D4 mutex without manual
// DB cleanup. 10 min is comfortably longer than a healthy 30-URL run
// (~2 min) but short enough that an orphan doesn't permanently block the
// source.
const StaleJobThreshold = 10 * time.Minute

// AnyRunningJob returns true if a job for the given source is currently
// running. Used by the service layer's mutex check (D4). Stale-running
// jobs (started_at < now - StaleJobThreshold) are ignored — they're treated
// as orphaned so a fresh click can proceed.
func (s *Store) AnyRunningJob(ctx context.Context, source string) (bool, error) {
	cutoff := time.Now().Add(-StaleJobThreshold)
	var n int64
	err := s.db.WithContext(ctx).
		Model(&Job{}).
		Where("source = ? AND status = ? AND started_at > ?", source, JobStatusRunning, cutoff).
		Count(&n).Error
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// MarkStaleJobsFailed flips any source's running rows older than
// StaleJobThreshold to failed. Called opportunistically by the service
// before a new run so the staging page doesn't show eternal-running rows.
func (s *Store) MarkStaleJobsFailed(ctx context.Context, source string) error {
	cutoff := time.Now().Add(-StaleJobThreshold)
	return s.db.WithContext(ctx).Model(&Job{}).
		Where("source = ? AND status = ? AND started_at <= ?", source, JobStatusRunning, cutoff).
		Updates(map[string]any{
			"status":      JobStatusFailed,
			"last_error":  "marked failed by stale-job sweeper (>10 min running)",
			"finished_at": time.Now(),
		}).Error
}

// UpdateJobProgress upserts the progress counters mid-run. Save() is fine
// because the Job's columns are bounded scalars (no array/map state).
func (s *Store) UpdateJobProgress(ctx context.Context, j *Job) error {
	return s.db.WithContext(ctx).Save(j).Error
}

// ============================================================================
// Staging
// ============================================================================

// StagingExists reports whether a (source, source_url) row already lives in
// staging — used by the scraper to skip the LLM cost (D5) on re-run.
func (s *Store) StagingExists(ctx context.Context, source, url string) (bool, error) {
	var n int64
	err := s.db.WithContext(ctx).
		Model(&Staging{}).
		Where("source = ? AND source_url = ?", source, url).
		Count(&n).Error
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// CreateStaging inserts a new candidate row. Returns ErrDuplicateStaging
// when (source, source_url) UNIQUE constraint fires — caller probably
// raced against another in-flight job.
func (s *Store) CreateStaging(ctx context.Context, st *Staging) error {
	if err := s.db.WithContext(ctx).Create(st).Error; err != nil {
		if isUniqueViolation(err) {
			return ErrDuplicateStaging
		}
		return err
	}
	return nil
}

// ListStaging returns paginated rows filtered by status.
func (s *Store) ListStaging(ctx context.Context, status string, page, pageSize int) ([]Staging, int64, error) {
	q := s.db.WithContext(ctx).Model(&Staging{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	if page <= 0 {
		page = 1
	}
	var rows []Staging
	if err := q.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *Store) GetStaging(ctx context.Context, id uint) (*Staging, error) {
	var st Staging
	if err := s.db.WithContext(ctx).First(&st, id).Error; err != nil {
		return nil, err
	}
	return &st, nil
}

// MarkPromoted records that admin promoted this row (and the resulting
// tourism_attractions.id, so an audit trail can show "this attraction came
// from this scrape"). Returns gorm.ErrRecordNotFound if the row isn't in
// pending state — protects against double-promote races.
func (s *Store) MarkPromoted(ctx context.Context, id uint, attractionID uint, reviewedBy *uint) error {
	now := time.Now()
	res := s.db.WithContext(ctx).Model(&Staging{}).
		Where("id = ? AND status = ?", id, StagingStatusPending).
		Updates(map[string]any{
			"status":         StagingStatusPromoted,
			"reviewed_by":    reviewedBy,
			"reviewed_at":    now,
			"promoted_to_id": attractionID,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// MarkRejected records admin's reject decision. Same not-found semantics
// as MarkPromoted.
func (s *Store) MarkRejected(ctx context.Context, id uint, reason string, reviewedBy *uint) error {
	now := time.Now()
	res := s.db.WithContext(ctx).Model(&Staging{}).
		Where("id = ? AND status = ?", id, StagingStatusPending).
		Updates(map[string]any{
			"status":        StagingStatusRejected,
			"reviewed_by":   reviewedBy,
			"reviewed_at":   now,
			"reject_reason": reason,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ============================================================================
// Helpers
// ============================================================================

// ErrDuplicateStaging is the sentinel CreateStaging returns on UNIQUE
// constraint violation so the service layer can treat duplicates as
// "skipped, no LLM cost" rather than a hard error.
var ErrDuplicateStaging = errors.New("scraper: staging row already exists for this URL")

// isUniqueViolation matches Postgres SQLSTATE 23505 from pgconn / pq error
// strings — same heuristic as tourism/store/admin_store.go to stay
// driver-agnostic.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
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
