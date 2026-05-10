package model

import "time"

// StockAlertCooldown — REQ-20260510-0004 — dedupes inventory alerts within
// a 4-hour window per (package_id, alert_type). The (package_id, alert_type)
// composite primary key + an UPSERT with a conditional WHERE in the
// cooldown store gives race-safe single-statement claim semantics.
//
// alert_type values:
//   - "inventory_low" — stock dropped to/below low_stock_threshold but > 0
//   - "inventory_out" — stock hit zero
//
// No CreatedAt/UpdatedAt — last_fired_at IS the only timestamp we care about.
type StockAlertCooldown struct {
	PackageID   uint      `gorm:"primaryKey;not null" json:"package_id"`
	AlertType   string    `gorm:"primaryKey;size:30;not null" json:"alert_type"`
	LastFiredAt time.Time `gorm:"not null" json:"last_fired_at"`
}

func (StockAlertCooldown) TableName() string {
	return "stock_alert_cooldowns"
}
