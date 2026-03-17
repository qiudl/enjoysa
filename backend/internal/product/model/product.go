package model

import (
	"time"

	"enjoysa-backend/internal/models"
	"gorm.io/gorm"
)

// ProductStatus 产品状态
type ProductStatus string

const (
	ProductStatusDraft    ProductStatus = "draft"
	ProductStatusPending  ProductStatus = "pending"
	ProductStatusApproved ProductStatus = "approved"
	ProductStatusRejected ProductStatus = "rejected"
	ProductStatusOffline  ProductStatus = "offline"
)

type Product struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 基本信息
	NameZh     string        `gorm:"size:200;not null" json:"name_zh"`
	NameEn     string        `gorm:"size:200;not null" json:"name_en"`
	SupplierID uint          `gorm:"index;not null" json:"supplier_id"`
	RegionID   uint          `gorm:"index" json:"region_id"`
	CategoryID uint          `gorm:"index" json:"category_id"`
	Status       ProductStatus `gorm:"size:20;default:draft" json:"status"`
	RejectReason string        `gorm:"size:500" json:"reject_reason,omitempty"`

	// 价格
	PriceFrom float64 `gorm:"type:decimal(10,2)" json:"price_from"`
	Currency  string  `gorm:"size:10;default:AUD" json:"currency"`

	// 双语详情
	SummaryZh     string `gorm:"size:500" json:"summary_zh"`
	SummaryEn     string `gorm:"size:500" json:"summary_en"`
	DescriptionZh string `gorm:"type:text" json:"description_zh"`
	DescriptionEn string `gorm:"type:text" json:"description_en"`
	AddressZh     string `gorm:"size:500" json:"address_zh"`
	AddressEn     string `gorm:"size:500" json:"address_en"`

	// 元数据
	Duration    string `gorm:"size:50" json:"duration"`      // e.g. "3 hours", "Full day"
	GroupSize   string `gorm:"size:50" json:"group_size"`     // e.g. "2-15"
	Tags        string `gorm:"type:jsonb;default:'[]'" json:"tags"` // JSON array of tag strings
	IsFeatured  bool   `gorm:"default:false" json:"is_featured"`
	SortOrder   int    `gorm:"default:0" json:"sort_order"`

	// 评分
	Rating      float64 `gorm:"type:decimal(3,2);default:0" json:"rating"`
	ReviewCount int     `gorm:"default:0" json:"review_count"`

	// 关联
	Supplier   *models.Supplier  `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	Region     *Region           `gorm:"foreignKey:RegionID" json:"region,omitempty"`
	Category   *Category         `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Images     []ProductImage    `gorm:"foreignKey:ProductID" json:"images,omitempty"`
	Packages   []ProductPackage  `gorm:"foreignKey:ProductID" json:"packages,omitempty"`
	Highlights []ProductHighlight `gorm:"foreignKey:ProductID" json:"highlights,omitempty"`
	FAQs       []ProductFAQ      `gorm:"foreignKey:ProductID" json:"faqs,omitempty"`
	Schedules  []ProductSchedule `gorm:"foreignKey:ProductID" json:"schedules,omitempty"`
}

func (Product) TableName() string {
	return "products"
}
