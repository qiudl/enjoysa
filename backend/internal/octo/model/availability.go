package model

import (
	"time"
)

// OctoAvailabilityCache 可用性缓存
// 将 product_schedule 映射为 OCTO availabilityId，供预订引用
type OctoAvailabilityCache struct {
	ID                string    `gorm:"size:128;primaryKey" json:"id"`                    // availabilityId
	ProductScheduleID uint      `gorm:"index;not null" json:"product_schedule_id"`        // 关联 product_schedule
	ProductID         uint      `gorm:"not null" json:"product_id"`
	OptionID          uint      `gorm:"not null" json:"option_id"`                        // package ID
	LocalDate         time.Time `gorm:"type:date;not null" json:"local_date"`
	StartTime         string    `gorm:"size:5;not null" json:"start_time"`                // "09:00"
	ExpiresAt         time.Time `gorm:"index;not null" json:"expires_at"`                 // 缓存过期时间
	CreatedAt         time.Time `json:"created_at"`
}

func (OctoAvailabilityCache) TableName() string {
	return "octo_availability_cache"
}
