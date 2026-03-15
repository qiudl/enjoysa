package handler

import (
	"time"

	"gorm.io/gorm"
)

type Banner struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	TitleZh     string `gorm:"size:200" json:"title_zh"`
	TitleEn     string `gorm:"size:200" json:"title_en"`
	SubtitleZh  string `gorm:"size:500" json:"subtitle_zh"`
	SubtitleEn  string `gorm:"size:500" json:"subtitle_en"`
	Image       string `gorm:"size:500" json:"image"`
	LinkURL     string `gorm:"size:500" json:"link_url"`
	SortOrder   int    `gorm:"default:0" json:"sort_order"`
	Status      string `gorm:"size:20;default:active" json:"status"` // active/inactive
}

func (Banner) TableName() string {
	return "banners"
}
