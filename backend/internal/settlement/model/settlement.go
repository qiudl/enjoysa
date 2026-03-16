package model

import (
	"time"

	"gorm.io/gorm"
)

type Settlement struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	SettlementNo string  `gorm:"uniqueIndex;size:30;not null" json:"settlement_no"`
	SupplierID   uint    `gorm:"index;not null" json:"supplier_id"`
	SupplierName string  `gorm:"size:100" json:"supplier_name"`
	PeriodStart  string  `gorm:"size:10" json:"period_start"`  // YYYY-MM-DD
	PeriodEnd    string  `gorm:"size:10" json:"period_end"`    // YYYY-MM-DD
	OrderCount   int     `json:"order_count"`
	GrossAmount  float64 `gorm:"type:decimal(12,2)" json:"gross_amount"`
	Commission   float64 `gorm:"type:decimal(12,2)" json:"commission"`
	NetAmount    float64 `gorm:"type:decimal(12,2)" json:"net_amount"`
	Status       string  `gorm:"size:20;default:pending" json:"status"` // pending, processing, completed, failed
	PaidAt       *string `json:"paid_at,omitempty"`
	Remark       string  `gorm:"size:500" json:"remark"`
}

func (Settlement) TableName() string {
	return "settlements"
}
