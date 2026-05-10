package store

import (
	"time"

	"gorm.io/gorm"
)

// StockAlertCooldownStore — REQ-20260510-0004 — single-table dedupe for
// inventory alerts. The TryClaim primitive is one INSERT … ON CONFLICT
// statement so concurrent goroutines firing for the same (packageID,
// alertType) race correctly: exactly one wins and gets to send the
// notification within the cooldown window.
type StockAlertCooldownStore struct {
	db *gorm.DB
}

func NewStockAlertCooldownStore(db *gorm.DB) *StockAlertCooldownStore {
	return &StockAlertCooldownStore{db: db}
}

// TryClaim atomically reserves the (packageID, alertType) cooldown slot
// for the next ttl. Returns true when the slot was free (or expired) and
// last_fired_at was advanced to now; false when the slot is still hot
// and the caller must suppress the alert.
//
// Implementation: an UPSERT whose ON CONFLICT path only fires when the
// existing row's last_fired_at is older than now-ttl. PostgreSQL reports
// RowsAffected = 0 when the conditional UPDATE doesn't match — so 0 rows
// affected means "still cooling down".
func (s *StockAlertCooldownStore) TryClaim(packageID uint, alertType string, ttl time.Duration) bool {
	now := time.Now()
	cutoff := now.Add(-ttl)
	res := s.db.Exec(`
		INSERT INTO stock_alert_cooldowns (package_id, alert_type, last_fired_at)
		VALUES (?, ?, ?)
		ON CONFLICT (package_id, alert_type)
		DO UPDATE SET last_fired_at = EXCLUDED.last_fired_at
		WHERE stock_alert_cooldowns.last_fired_at < ?
	`, packageID, alertType, now, cutoff)
	if res.Error != nil {
		return false
	}
	return res.RowsAffected > 0
}
