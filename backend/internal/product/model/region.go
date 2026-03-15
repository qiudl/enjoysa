package model

import (
	"time"

	"gorm.io/gorm"
)

type Region struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Slug           string `gorm:"uniqueIndex;size:50;not null" json:"slug"`
	NameZh         string `gorm:"size:100;not null" json:"name_zh"`
	NameEn         string `gorm:"size:100;not null" json:"name_en"`
	DescZh         string `gorm:"size:2000" json:"desc_zh"`
	DescEn         string `gorm:"size:2000" json:"desc_en"`
	TaglineZh      string `gorm:"size:200" json:"tagline_zh"`
	TaglineEn      string `gorm:"size:200" json:"tagline_en"`
	Image          string `gorm:"size:500" json:"image"`
	SortOrder      int    `gorm:"default:0" json:"sort_order"`
	AttractionCount int   `gorm:"default:0" json:"attraction_count"`
}

func (Region) TableName() string {
	return "regions"
}
