package model

import (
	"time"

	"gorm.io/gorm"
)

type Category struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Slug      string `gorm:"uniqueIndex;size:50;not null" json:"slug"`
	NameZh    string `gorm:"size:100;not null" json:"name_zh"`
	NameEn    string `gorm:"size:100;not null" json:"name_en"`
	Icon      string `gorm:"size:50" json:"icon"`
	SortOrder int    `gorm:"default:0" json:"sort_order"`
}

func (Category) TableName() string {
	return "categories"
}
