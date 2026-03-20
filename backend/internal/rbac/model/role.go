package model

import (
	"time"

	"gorm.io/gorm"
)

type SysRole struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Name      string `gorm:"size:64;not null;uniqueIndex" json:"name"`
	Code      string `gorm:"size:64;not null;uniqueIndex" json:"code"`
	Note      string `gorm:"size:255" json:"note"`
	SortOrder int    `gorm:"default:100" json:"sort_order"`
	Status    int    `gorm:"default:1;comment:0=disabled 1=enabled" json:"status"`
	IsSystem  bool   `gorm:"default:false;comment:system roles cannot be deleted" json:"is_system"`
}

func (SysRole) TableName() string {
	return "sys_roles"
}
