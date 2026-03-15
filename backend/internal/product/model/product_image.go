package model

import (
	"time"

	"gorm.io/gorm"
)

type ProductImage struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	ProductID uint   `gorm:"index;not null" json:"product_id"`
	URL       string `gorm:"size:500;not null" json:"url"`
	SortOrder int    `gorm:"default:0" json:"sort_order"`
	IsCover   bool   `gorm:"default:false" json:"is_cover"`
}

func (ProductImage) TableName() string {
	return "product_images"
}
