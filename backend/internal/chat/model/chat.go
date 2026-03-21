package model

import (
	"time"

	"gorm.io/gorm"
)

type ChatSession struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID   uint   `gorm:"index;not null" json:"user_id"`
	UserType string `gorm:"size:20;not null;default:guest" json:"user_type"` // guest, user, supplier, admin
	Title    string `gorm:"size:200" json:"title"`
	Language string `gorm:"size:10;default:en" json:"language"`
	Context  string `gorm:"type:text" json:"context"` // JSON: page context injected from frontend
}

func (ChatSession) TableName() string {
	return "chat_sessions"
}

type ChatMessage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	SessionID uint   `gorm:"index;not null" json:"session_id"`
	Role      string `gorm:"size:20;not null" json:"role"` // user, assistant, system
	Content   string `gorm:"type:text;not null" json:"content"`
}

func (ChatMessage) TableName() string {
	return "chat_messages"
}
