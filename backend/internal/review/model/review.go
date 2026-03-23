package model

import (
	"time"

	"enjoysa-backend/internal/models"
	productmodel "enjoysa-backend/internal/product/model"
	"gorm.io/gorm"
)

type Review struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	OrderID    uint `gorm:"uniqueIndex;not null" json:"order_id"`
	UserID     uint `gorm:"index;not null" json:"user_id"`
	SupplierID uint `gorm:"index;not null" json:"supplier_id"`
	ProductID  uint `gorm:"index;not null" json:"product_id"`

	Rating  int    `gorm:"not null" json:"rating"`
	Content string `gorm:"type:text" json:"content"`
	Photos  string `gorm:"type:jsonb;default:'[]'" json:"photos"`
	Status  string `gorm:"size:20;default:published" json:"status"` // published, hidden

	Reply     string     `gorm:"type:text" json:"reply"`
	RepliedAt *time.Time `json:"replied_at,omitempty"`
	RepliedBy *uint      `json:"replied_by,omitempty"`

	// Relations for preload
	User    *models.User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Product *productmodel.Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

func (Review) TableName() string {
	return "reviews"
}

type ReviewStats struct {
	TotalReviews int     `json:"total_reviews"`
	AvgRating    float64 `json:"avg_rating"`
	RepliedCount int     `json:"replied_count"`
	ReplyRate    float64 `json:"reply_rate"`
	Rating5      int     `json:"rating_5"`
	Rating4      int     `json:"rating_4"`
	Rating3      int     `json:"rating_3"`
	Rating2      int     `json:"rating_2"`
	Rating1      int     `json:"rating_1"`
}
