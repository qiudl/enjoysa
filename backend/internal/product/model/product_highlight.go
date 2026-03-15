package model

import (
	"time"

	"gorm.io/gorm"
)

type ProductHighlight struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	ProductID uint   `gorm:"index;not null" json:"product_id"`
	TitleZh   string `gorm:"size:200" json:"title_zh"`
	TitleEn   string `gorm:"size:200" json:"title_en"`
	DescZh    string `gorm:"size:1000" json:"desc_zh"`
	DescEn    string `gorm:"size:1000" json:"desc_en"`
	SortOrder int    `gorm:"default:0" json:"sort_order"`
}

func (ProductHighlight) TableName() string {
	return "product_highlights"
}
