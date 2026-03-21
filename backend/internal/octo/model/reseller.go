package model

import (
	"time"

	"gorm.io/gorm"
)

// OctoReseller 分销商（如 Trip.com）
type OctoReseller struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Name   string `gorm:"size:128;not null" json:"name"`
	APIKey string `gorm:"size:256;uniqueIndex;not null" json:"-"`
	Status string `gorm:"size:20;not null;default:active" json:"status"` // active / suspended
	Config string `gorm:"type:jsonb" json:"config"`                      // 佣金率等配置
}

func (OctoReseller) TableName() string {
	return "octo_resellers"
}
