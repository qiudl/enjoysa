package model

import (
	"time"

	"gorm.io/gorm"
)

type ProductPackage struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	ProductID uint    `gorm:"index;not null" json:"product_id"`
	NameZh    string  `gorm:"size:200;not null" json:"name_zh"`
	NameEn    string  `gorm:"size:200;not null" json:"name_en"`
	DescZh    string  `gorm:"size:1000" json:"desc_zh"`
	DescEn    string  `gorm:"size:1000" json:"desc_en"`
	Price     float64 `gorm:"type:decimal(10,2);not null" json:"price"`
	SortOrder int     `gorm:"default:0" json:"sort_order"`

	// REQ-20260509-0035: 库存。-1 = 无限量（向后兼容历史商品）。
	// 下单事务 SELECT FOR UPDATE 这一行避免超卖；cancel 回补 sold。
	StockTotal int `gorm:"not null;default:-1" json:"stock_total"`
	StockSold  int `gorm:"not null;default:0" json:"stock_sold"`

	// REQ-20260510-0004: low-stock alert threshold per package. 0 = alerts off
	// for this package; >0 fires inventory_low when stock_total - stock_sold
	// drops to/below this value (and is still > 0). inventory_out fires on
	// remaining == 0 regardless of threshold. Skipped entirely for unlimited
	// (stock_total == -1) packages.
	LowStockThreshold int `gorm:"not null;default:5" json:"low_stock_threshold"`
}

func (ProductPackage) TableName() string {
	return "product_packages"
}
