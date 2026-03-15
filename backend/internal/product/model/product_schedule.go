package model

import (
	"time"

	"gorm.io/gorm"
)

type ProductSchedule struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	ProductID   uint      `gorm:"index;not null" json:"product_id"`
	PackageID   uint      `gorm:"index" json:"package_id"`
	Date        time.Time `gorm:"index;not null" json:"date"`
	TimeSlot    string    `gorm:"size:20" json:"time_slot"`       // e.g. "09:00", "14:00"
	TotalSlots  int       `gorm:"not null" json:"total_slots"`
	BookedSlots int       `gorm:"default:0" json:"booked_slots"`
	Price       *float64  `gorm:"type:decimal(10,2)" json:"price"` // override package price
	Status      string    `gorm:"size:20;default:available" json:"status"` // available/full/cancelled
}

func (ProductSchedule) TableName() string {
	return "product_schedules"
}

func (s *ProductSchedule) AvailableSlots() int {
	return s.TotalSlots - s.BookedSlots
}
