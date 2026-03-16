package model

import (
	"time"

	"gorm.io/gorm"
)

type Setting struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Key   string `gorm:"uniqueIndex;size:100;not null" json:"key"`
	Value string `gorm:"type:text" json:"value"`
	Group string `gorm:"size:50;index" json:"group"` // general, payments, notifications, security
}

func (Setting) TableName() string {
	return "settings"
}
