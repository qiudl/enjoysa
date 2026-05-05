package model

import "time"

// ChatMessageShare records one share of one or more ai-chat messages to an
// external IM channel (Feishu group bot in the MVP).
type ChatMessageShare struct {
	ID         uint      `gorm:"primarykey" json:"id"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`

	SessionID  uint   `gorm:"index;not null" json:"session_id"`
	UserID     uint   `gorm:"index;not null" json:"user_id"`
	UserType   string `gorm:"size:20;not null" json:"user_type"`
	SupplierID *uint  `gorm:"index" json:"supplier_id,omitempty"`

	MessageIDs string `gorm:"type:text;not null" json:"message_ids"` // JSON array
	Note       string `gorm:"size:500" json:"note,omitempty"`

	Channel       string `gorm:"size:20;not null;default:feishu" json:"channel"`
	AddedToKB     bool   `gorm:"not null;default:false" json:"added_to_kb"`
	KBKnowledgeID *uint  `gorm:"index" json:"kb_knowledge_id,omitempty"`

	Success      bool   `gorm:"not null;default:false" json:"success"`
	ErrorMessage string `gorm:"size:500" json:"error_message,omitempty"`
	FeishuMsgID  string `gorm:"size:100" json:"feishu_msg_id,omitempty"`
}

func (ChatMessageShare) TableName() string { return "chat_message_shares" }
