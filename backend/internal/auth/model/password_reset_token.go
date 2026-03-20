package model

import (
	"time"

	"gorm.io/gorm"
)

type PasswordResetToken struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	UserID    uint           `gorm:"index;not null" json:"user_id"`
	Token     string         `gorm:"uniqueIndex;size:128;not null" json:"-"`
	ExpiresAt time.Time      `gorm:"not null" json:"expires_at"`
	UsedAt    *time.Time     `json:"used_at,omitempty"`
}
