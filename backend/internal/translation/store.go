package translation

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Store struct {
	db *gorm.DB
}

func NewStore(db *gorm.DB) *Store {
	return &Store{db: db}
}

// DB returns the underlying gorm.DB so callers can compose the enqueue with
// their own transaction (e.g. updating product status + creating a task in a
// single commit).
func (s *Store) DB() *gorm.DB {
	return s.db
}

// CreateInTx inserts a task using the supplied transaction (or s.db when nil).
func (s *Store) CreateInTx(tx *gorm.DB, task *TranslationTask) error {
	if tx == nil {
		tx = s.db
	}
	return tx.Create(task).Error
}

// GetByID returns a task by primary key.
func (s *Store) GetByID(id uint) (*TranslationTask, error) {
	var t TranslationTask
	if err := s.db.First(&t, id).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

// GetLatestForTarget returns the most recently created task for a target.
func (s *Store) GetLatestForTarget(targetType TargetType, targetID uint) (*TranslationTask, error) {
	var t TranslationTask
	err := s.db.Where("target_type = ? AND target_id = ?", targetType, targetID).
		Order("id DESC").First(&t).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

// ClaimNextPending atomically picks the oldest pending task and marks it as
// running. Uses SELECT ... FOR UPDATE SKIP LOCKED so concurrent workers cannot
// claim the same row. Returns nil, nil when no work is available.
func (s *Store) ClaimNextPending() (*TranslationTask, error) {
	var task *TranslationTask
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var t TranslationTask
		err := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
			Where("status = ?", StatusPending).
			Order("id ASC").
			First(&t).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		now := time.Now()
		t.Status = StatusRunning
		t.StartedAt = &now
		if err := tx.Save(&t).Error; err != nil {
			return err
		}
		task = &t
		return nil
	})
	return task, err
}

// MarkSuccess transitions a task to success and stores the output.
func (s *Store) MarkSuccess(id uint, output []byte, promptTokens, completionTokens int, costUSD float64, provider, modelVersion string) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":            StatusSuccess,
		"completed_at":      now,
		"fields_output":     output,
		"prompt_tokens":     promptTokens,
		"completion_tokens": completionTokens,
		"cost_usd":          costUSD,
		"provider":          provider,
		"model_version":     modelVersion,
		"last_error":        "",
	}
	return s.db.Model(&TranslationTask{}).Where("id = ?", id).Updates(updates).Error
}

// MarkFailedOrRetry decides whether to bump retries (back to pending) or to
// transition to terminal failed state based on the configured max_retries.
func (s *Store) MarkFailedOrRetry(id uint, errMsg string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var t TranslationTask
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&t, id).Error; err != nil {
			return err
		}
		t.Retries++
		t.LastError = truncate(errMsg, 2000)
		now := time.Now()
		if t.Retries >= t.MaxRetries {
			t.Status = StatusFailed
			t.CompletedAt = &now
		} else {
			t.Status = StatusPending
			t.StartedAt = nil
		}
		return tx.Save(&t).Error
	})
}

// ResetStuckRunning is called at worker startup to recover tasks left in
// running state by a previous crashed worker.
func (s *Store) ResetStuckRunning(olderThan time.Duration) (int64, error) {
	cutoff := time.Now().Add(-olderThan)
	res := s.db.Model(&TranslationTask{}).
		Where("status = ? AND started_at < ?", StatusRunning, cutoff).
		Updates(map[string]interface{}{
			"status":     StatusPending,
			"started_at": nil,
		})
	return res.RowsAffected, res.Error
}

// RetryFailed resets a failed task back to pending so the worker picks it up
// again. Returns an error if the task is not in failed state.
func (s *Store) RetryFailed(id uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var t TranslationTask
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&t, id).Error; err != nil {
			return err
		}
		if t.Status != StatusFailed {
			return fmt.Errorf("task is not in failed state (current: %s)", t.Status)
		}
		t.Status = StatusPending
		t.Retries = 0
		t.LastError = ""
		t.StartedAt = nil
		t.CompletedAt = nil
		return tx.Save(&t).Error
	})
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "...[truncated]"
}
