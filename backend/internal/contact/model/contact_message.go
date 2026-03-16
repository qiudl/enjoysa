package model

import (
	"time"

	"gorm.io/gorm"
)

type ContactMessage struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Name    string `gorm:"size:100;not null" json:"name"`
	Email   string `gorm:"size:100;not null" json:"email"`
	Phone   string `gorm:"size:30" json:"phone"`
	Subject string `gorm:"size:200" json:"subject"`
	Message string `gorm:"type:text;not null" json:"message"`
	Status  string `gorm:"size:20;default:unread" json:"status"` // unread, read, replied
}

func (ContactMessage) TableName() string {
	return "contact_messages"
}
