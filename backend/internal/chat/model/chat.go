package model

import (
	"time"

	"github.com/lib/pq"
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

// ChatMessage stores both the legacy 1-on-1 chat (session_id non-zero,
// channel_id null) and the new group-chat (channel_id non-null) — see
// REQ-20260509-0037. The migration script in cmd/migrate-chat-groups
// back-fills channel_id for existing rows.
type ChatMessage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	// Legacy 1-on-1
	SessionID uint   `gorm:"index;not null;default:0" json:"session_id"`
	Role      string `gorm:"size:20;not null" json:"role"` // user, assistant, system
	Content   string `gorm:"type:text;not null" json:"content"`

	// Group chat (REQ-20260509-0037)
	ChannelID      *uint         `json:"channel_id,omitempty"`
	ThreadParentID *uint         `json:"thread_parent_id,omitempty"`
	SenderType     string        `gorm:"size:20" json:"sender_type,omitempty"` // user | ai | human
	SenderAgentID  *uint         `json:"sender_agent_id,omitempty"`
	SenderAdminID  *uint         `json:"sender_admin_id,omitempty"`
	Mentions       pq.Int64Array `gorm:"type:bigint[];not null;default:'{}'" json:"mentions,omitempty"`
	AlsoInChannel  bool          `gorm:"not null;default:false" json:"also_in_channel,omitempty"`
}

func (ChatMessage) TableName() string {
	return "chat_messages"
}
