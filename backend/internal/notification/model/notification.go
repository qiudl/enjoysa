package model

import (
	"time"

	"gorm.io/gorm"
)

type Notification struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RecipientType string `gorm:"size:20;index;not null" json:"recipient_type"` // supplier, user, admin
	RecipientID   uint   `gorm:"index;not null" json:"recipient_id"`
	Type          string `gorm:"size:30;index;not null" json:"type"` // new_order, order_cancelled, product_approved, product_rejected, new_review, settlement
	Title         string `gorm:"size:200;not null" json:"title"`
	Content       string `gorm:"type:text" json:"content"`
	RelatedType   string `gorm:"size:30" json:"related_type,omitempty"` // order, product, review, settlement
	RelatedID     uint   `json:"related_id,omitempty"`
	IsRead        bool   `gorm:"default:false" json:"is_read"`
	ReadAt        *time.Time `json:"read_at,omitempty"`
}

func (Notification) TableName() string {
	return "notifications"
}
